import { _decorator, Component, Node, Vec3 } from 'cc';
import { SignalBus } from 'db://assets/PLAGameFoundation/signalBus/SignalBus';
import { VoxelGrid } from '../domain/VoxelGrid';
import { ReachabilitySolver } from '../domain/ReachabilitySolver';
import { TargetSelector } from '../domain/TargetSelector';
import { HiveBoard } from '../domain/HiveBoard';
import { ALL_DIRS_MASK } from '../domain/GridDirections';
import { evaluateOutcome, GameOutcome } from '../domain/GameRules';
import { SculptureView } from '../presentation/sculpture/SculptureView';
import { SculptureRotator } from '../presentation/sculpture/SculptureRotator';
import { computeExitMask, computeViewMatrix } from '../presentation/sculpture/SculptureViewMath';
import { HiveBoardView } from '../presentation/hive/HiveBoardView';
import { BeeSwarm } from '../presentation/bee/BeeSwarm';
import { GameplayConfig } from './GameplayConfig';
import { GameTime } from './GameTime';
import {
    BeeLaunchedSignal, CubePulledSignal, GameOutcomeSignal, HiveActivatedSignal,
    HiveTapRejectedSignal, LevelProgressSignal, RotateHintSignal,
} from './GameplaySignals';

const { ccclass } = _decorator;

/** Max reachability refresh rate while cubes are being removed (stale data is safe). */
const SOLVE_INTERVAL = 0.1;
const OUTCOME_CHECK_INTERVAL = 0.25;
/** Hives wait for the jump animation before firing. */
const FIRST_SHOT_DELAY = 0.3;
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
    private omniSolver: ReachabilitySolver = null!;
    private selector: TargetSelector = null!;
    private reserved: Uint8Array = null!;
    private fireTimers: number[] = [];
    private readonly view = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    private readonly gridPath: number[] = [];
    private readonly launchPos = new Vec3();
    private readonly pulledPos = new Vec3();
    private solveCooldown = 0;
    private outcomeCooldown = 0;
    private lastViewVersion = -1;
    private lastExitMask = -1;
    private hintVisible = false;
    private outcome: GameOutcome = 'playing';
    private totalCubes = 0;

    init(deps: GameplayDeps): void {
        this.d = deps;
        this.solver = new ReachabilitySolver(deps.grid, deps.config.maxTurns);
        this.omniSolver = new ReachabilitySolver(deps.grid, deps.config.maxTurns);
        this.selector = new TargetSelector(deps.grid, this.solver);
        this.reserved = new Uint8Array(deps.grid.cellCount);
        this.fireTimers = new Array(deps.board.slotCount).fill(0);
        this.totalCubes = deps.grid.aliveCount;
        deps.swarm.onGrab = (target, color) => this.onCubeGrabbed(target, color);
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
        this.fireTimers[result.slot] = FIRST_SHOT_DELAY;
        this.d.hives.onHiveActivated(result.hive, result.slot);
        SignalBus.instance.fire(new HiveActivatedSignal(result.hive.spec.id, result.slot));
    }

    update(dt: number): void {
        if (!this.running || this.isFinished) return;
        const sdt = GameTime.scaled(dt);
        // Live-tunable parameters (dashboard updates apply immediately).
        this.d.swarm.beeSpeed = this.d.config.beeSpeed;
        this.d.rotator.autoRotateSpeed = this.d.config.autoRotateSpeed;
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
        const { board, swarm, config, hives } = this.d;
        for (let slot = 0; slot < board.slotCount; slot++) {
            const hive = board.slot(slot);
            if (!hive) continue;
            this.fireTimers[slot] -= dt;
            while (this.fireTimers[slot] <= 0 && hive.slot === slot) {
                if (swarm.count >= config.maxBeesInFlight) return;
                const target = this.selector.next(hive.spec.color, this.reserved);
                if (target === -1) {
                    this.fireTimers[slot] = 0;
                    break;
                }
                if (!this.solver.tracePath(target, this.gridPath)) throw new Error(`[Gameplay] selected unreachable cube ${target}`);
                this.reserved[target] = 1;
                swarm.launch({ color: hive.spec.color, from: hives.launchPosition(slot, this.launchPos), target, gridPath: this.gridPath });
                hives.onBeeLaunched(hive);
                SignalBus.instance.fire(new BeeLaunchedSignal(hive.spec.color));
                this.fireTimers[slot] += config.fireInterval;
                if (board.consumeAmmo(hive)) hives.onHiveDepleted(hive);
            }
        }
    }

    private onCubeGrabbed(target: number, color: number): void {
        const { grid, sculpture } = this.d;
        sculpture.gridToWorld(grid.xs[target], grid.ys[target], grid.zs[target], this.pulledPos);
        grid.remove(target);
        this.reserved[target] = 0;
        sculpture.markCellRemoved(target);
        SignalBus.instance.fire(new CubePulledSignal(color, this.pulledPos));
        SignalBus.instance.fire(new LevelProgressSignal(this.totalCubes - grid.aliveCount, this.totalCubes));
        if (grid.aliveCount === 0) this.finish('win', WIN_DELAY);
    }

    private checkOutcome(): void {
        const { grid, board, swarm } = this.d;
        if (grid.aliveCount === 0) return; // win is handled on the last grab
        const active = board.activeHives();
        const omniReady = () => {
            if (!this.omniSolver.isUpToDate(ALL_DIRS_MASK)) this.omniSolver.solve(ALL_DIRS_MASK);
        };
        const outcome = evaluateOutcome({
            aliveCubes: grid.aliveCount,
            freeSlots: board.freeSlotCount,
            beesInFlight: swarm.pendingGrabs,
            activeColors: active.map((h) => h.spec.color),
            hasTargetFromAnyView: (color) => {
                omniReady();
                return this.hasUnreservedTarget(this.omniSolver, color);
            },
        });
        if (outcome === 'lose') {
            this.finish('lose', 0.4);
            return;
        }

        // Hint: hives are waiting but nothing of their colors is reachable from this angle.
        const stuckHere = active.length > 0 && swarm.pendingGrabs === 0
            && active.every((h) => this.selector.next(h.spec.color, this.reserved) === -1);
        this.setHint(stuckHere);
    }

    private hasUnreservedTarget(solver: ReachabilitySolver, color: number): boolean {
        const g = this.d.grid;
        for (let i = 0; i < g.cellCount; i++) {
            if (g.colorAt(i) === color && this.reserved[i] === 0 && solver.isReachable(i)) return true;
        }
        return false;
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
