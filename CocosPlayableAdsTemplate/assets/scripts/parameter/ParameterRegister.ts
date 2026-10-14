import {ParameterController} from "./ParameterController";
import {BaseParameterRegister} from "db://assets/PlayableParamterTool/base/BaseParameterRegister";

export class ParameterRegister extends BaseParameterRegister {
    public registerParameters(): void {
        ParameterController.instance.SetUpOnUpdate();
    }
}