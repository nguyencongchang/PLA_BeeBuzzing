import {_decorator, Component, Node} from 'cc';
import {ParameterRegister} from "./ParameterRegister";
import {BaseParameterManager} from "db://assets/PlayableParamterTool/base/BaseParameterManager";
import {Vsdk} from "db://assets/PlayableParamterTool/sdk/voodoo";
import {PlayableConfigProvider} from "db://assets/PlayableParamterTool/config/PlayableConfigProvider";
import {PlayableConfig, CURRENT_SDK} from "./config/PlayableConfig";
import {PlayableConfigMeta} from "./config/PlayableConfigMeta";
import {DetectPlatform} from "db://assets/PLAGameFoundation/gameControl/utilities/handler/detectPlatform";
import {Constant} from "../constant/constant";
import {ParameterToolRuntime} from "db://assets/PlayableParamterTool/ParameterToolRuntime";
import {SignalBus} from "db://assets/PLAGameFoundation/signalBus";
import {AudioService} from "db://assets/PLAGameFoundation/gameControl/utilities/AudioSystem/AudioService";
import {AnimationPresetPlayer} from "db://assets/PLAGameFoundation/animations/AnimationPresetPlayer";

const {ccclass} = _decorator;

@ccclass('ParameterManager')
export class ParameterManager extends BaseParameterManager<ParameterRegister> {
  protected createParameterRegister(): ParameterRegister {
    // === DEPENDENCY INJECTION ===

    // 0. Wire runtime seams của PlayableParamterTool (v1.0.2) sang PLAGameFoundation.
    //    Tool đã decoupled khỏi framework: nó fire signal / volume / preset-animation
    //    qua ParameterToolRuntime (NO-OP tới khi host đăng ký provider). PHẢI chạy TRƯỚC
    //    khi BaseParameterManager.onLoad gọi initializeParameterConfig(), nếu không
    //    AllAsyncParametersReadySignal không bắn → level không generate.
    ParameterToolRuntime.registerSignalEmitter(SignalBus.instance);
    ParameterToolRuntime.registerVolumeSink(AudioService.instance);
    ParameterToolRuntime.registerPresetPlayer({play: (node, config) => AnimationPresetPlayer.play(node, config)});

    // 1. Inject store links vào PLAGameFoundation
    DetectPlatform.setStoreLinks({
      android: Constant.SRORE_LINK.ANDROID_LINK,
      ios: Constant.SRORE_LINK.IOS_LINK
    });

    // 2. Inject PlayableConfig + metadata sidecar vào PlayableParamterTool
    //    (metadata → emit vào playable-config.json dưới metadata.parameters cho AI-assist)
    PlayableConfigProvider.initialize(PlayableConfig, PlayableConfigMeta, CURRENT_SDK);

    return new ParameterRegister();
  }

  public static redirect() {
    Vsdk.vsdk.redirectToInstallPage();
  }
}
