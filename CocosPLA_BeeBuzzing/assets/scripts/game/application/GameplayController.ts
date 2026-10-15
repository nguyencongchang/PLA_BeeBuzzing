import { _decorator, Component, Node, Vec3 } from 'cc';
import { SignalBus } from 'db://assets/PLAGameFoundation/signalBus/SignalBus';
import { VoxelGrid } from '../domain/VoxelGrid';
import { ReachabilitySolver } from '../domain/ReachabilitySolver';
import { TargetSelector } from '../domain/TargetSelector';
import { HiveBoard } from '../domain/HiveBoard';
import { GameOutcome } from '../domain/GameRules';
import { SculptureView } from '../presentation/sculpture/SculptureView';
import { SculptureRotator } from '../presentation/sculpture/SculptureRotator';
import { computeExitMask, computeViewMatrix } from '../presentation/sculpture/SculptureViewMath';
import { HiveBoardView } from '../presentation/hive/HiveBoardView';
import { BeeSwarm } from '../presentation/bee/BeeSwarm';
import { GameplayConfig } from './GameplayConfig';
import { GameTime } from './GameTime';
import { GameOutcomeMonitor } from './GameOutcomeMonitor';
import {
    BeeLaunchedSignal,
    CubePluckedSignal,
    GameOutcomeSignal,
    HiveActivatedSignal,
    HiveTapRejectedSignal,
    RotateHintSignal,
} from './GameplaySignals';

const { ccclass } = _decorator;

/** Max reachability refresh rate while cubes are being removed (stale data is safe). */
const SOLVE_INTERVAL = 0.1;
const OUTCOME_CHECK_INTERVAL = 0.25;
/** Hives land (real time) and settle briefly before the first bee comes out, as in the reference. */
const FIRST_SHOT_DELAY = 0.55;
/** Let the last bees fly out before showing the win end card. */
const WIN_DELAY = 1.0;

export interface GameplayDeps {
    readonly config: GameplayConfig;
    readonly grid: VoxelGrid;
    readonly board: HiveBoard;
    readonly camera: Node;
    readonly sculpture: SculptureView;
    readonly rotator: SculptureRotator;
    readonly hives: HiveBoardView;
    readonly swarm: BeeSwarm;
}

/**
 * Orchestrates one level: hive taps, the continuous fire loop of active hives, cube
 * removal, reachability refresh and win/lose evaluation. Owns no rendering itself.
 */
@ccclass('GameplayController')
export class GameplayController extends Component {
    /** False until the intro / loading screen hands over control. */
    running = false;

    private d: GameplayDeps = null!;
    private solver: ReachabilitySolver = null!;
    private selector: TargetSelector = null!;
    private monitor: GameOutcomeMonitor = null!;
    private reserved: Uint8Array = null!;
    private fireTimers: number[] = [];
    private firstSlot = 0;
    private readonly view = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    private readonly gridPath: number[] = [];
    private readonly launchPos = new Vec3();
    private solveCooldown = 0;
    private outcomeCooldown = 0;
    private lastViewVersion = -1;
    private lastExitMask = -1;
    private hintVisible = false;
    private outcome: GameOutcome = 'playing';

    init(deps: GameplayDeps): void {
        this.d = deps;
        this.solver = new ReachabilitySolver(deps.grid, deps.config.maxTurns);
        this.selector = new TargetSelector(deps.grid, this.solver);
        this.monitor = new GameOutcomeMonitor(deps.grid, deps.board, this.selector, deps.config.maxTurns);
        this.reserved = new Uint8Array(deps.grid.cellCount);
        this.fireTimers = new Array(deps.board.slotCount).fill(0);
        deps.swarm.onGrab = (target) => this.onCubeGrabbed(target);
        this.refreshReachability(true);
    }

    get isFinished(): boolean {
        return this.outcome !== 'playing';
    }

    /** Player tapped hive line `line`. */
    tapLine(line: number): void {
        if (!this.running || this.isFinished) return;
        const result = this.d.board.tap(line);
        if ('reason' in result) {
            this.d.hives.onTapRejected(line);
            SignalBus.instance.fire(new HiveTapRejectedSignal(line, result.reason));
            return;
        }
        // Timers run on game time; the jump animation runs on real time.
        this.fireTimers[result.slot] = FIRST_SHOT_DELAY * GameTime.scale;
        this.d.hives.onHiveActivated(result.hive, result.slot);
        SignalBus.instance.fire(new HiveActivatedSignal(result.hive.spec.id, result.slot));
    }

    update(dt: number): void {
        if (!this.running || this.isFinished) return;
        const { swarm, rotator, config } = this.d;
        // Live-tunable parameters (dashboard updates apply immediately).
        swarm.beeSpeed = config.beeSpeed;
        rotator.autoRotateSpeed = config.autoRotateSpeed;

        const sdt = GameTime.scaled(dt);
        this.solveCooldown -= sdt;
        this.refreshReachability(false);
        this.fireActiveHives(sdt);

        this.outcomeCooldown -= dt;
        if (this.outcomeCooldown <= 0) {
            this.outcomeCooldown = OUTCOME_CHECK_INTERVAL;
            this.checkOutcome();
        }
    }

    private refreshReachability(force: boolean): void {
        const { config, sculpture, camera, rotator } = this.d;
        const viewChanged = rotator.viewVersion !== this.lastViewVersion;
        const mask = computeExitMask(sculpture.node, camera, sculpture.gridSpace, config.facingThreshold);
        const needSolve = force || mask !== this.lastExitMask || (!this.solver.isUpToDate(mask) && this.solveCooldown <= 0);
        if (needSolve) {
            this.solver.solve(mask);
            this.lastExitMask = mask;
            this.solveCooldown = SOLVE_INTERVAL;
        }
        if (needSolve || viewChanged) {
            this.lastViewVersion = rotator.viewVersion;
            this.selector.rebuild(computeViewMatrix(sculpture.node, camera, sculpture.gridSpace, this.view));
        }
    }

    private fireActiveHives(dt: number): void {
        const { board } = this.d;
        // Rotate the starting slot so a bee cap never starves the same slots.
        this.firstSlot = (this.firstSlot + 1) % board.slotCount;
        for (let k = 0; k < board.slotCount; k++) {
            const slot = (this.firstSlot + k) % board.slotCount;
            const hive = board.slot(slot);
            if (!hive) continue;
            this.fireTimers[slot] -= dt;
            while (this.fireTimers[slot] <= 0 && hive.slot === slot) {
                if (!this.fireOne(slot)) {
                    this.fireTimers[slot] = 0; // no target / capped: wait without building up debt
                    break;
                }
            }
        }
    }

    /** Launches one bee from `slot`; false when there is no target or the bee cap is hit. */
    private fireOne(slot: number): boolean {
        const { board, swarm, config, hives } = this.d;
        const hive = board.slot(slot)!;
        if (swarm.count >= config.maxBeesInFlight) return false;
        const target = this.selector.next(hive.spec.color, this.reserved);
        if (target === -1) return false;
        if (!this.solver.tracePath(target, this.gridPath)) throw new Error(`[Gameplay] selected unreachable cube ${target}`);
        this.reserved[target] = 1;
        swarm.launch({ color: hive.spec.color, from: hives.launchPosition(slot, this.launchPos), target, gridPath: this.gridPath });
        hives.onBeeLaunched(hive);
        SignalBus.instance.fire(new BeeLaunchedSignal(hive.spec.color));
        this.fireTimers[slot] += config.fireInterval;
        if (board.consumeAmmo(hive)) hives.onHiveDepleted(hive);
        return true;
    }

    private onCubeGrabbed(target: number): void {
        const { grid, sculpture } = this.d;
        grid.remove(target);
        this.reserved[target] = 0;
        sculpture.markCellRemoved(target);
        SignalBus.instance.fire(new CubePluckedSignal());
        if (grid.aliveCount === 0) this.finish('win', WIN_DELAY);
    }

    private checkOutcome(): void {
        if (this.d.grid.aliveCount === 0) return; // win is handled on the last grab
        const report = this.monitor.evaluate(this.reserved, this.d.swarm.pendingGrabs);
        if (report.outcome === 'lose') {
            this.finish('lose', 0.4);
            return;
        }
        this.setHint(report.rotateHint);
    }

    private setHint(visible: boolean): void {
        if (visible === this.hintVisible) return;
        this.hintVisible = visible;
        SignalBus.instance.fire(new RotateHintSignal(visible));
    }

    private finish(outcome: GameOutcome, delay: number): void {
        if (this.isFinished) return;
        this.outcome = outcome;
        this.setHint(false);
        this.scheduleOnce(() => SignalBus.instance.fire(new GameOutcomeSignal(outcome)), delay);
    }
}
