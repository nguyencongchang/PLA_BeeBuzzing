import { sys } from 'cc';
import { Constant } from 'db://assets/scripts/constant/constant';
import gameEndHandler from "db://assets/PLAGameFoundation/gameControl/utilities/handler/gameEndHandler";
import {ParameterManager} from "db://assets/scripts/parameter/ParameterManager";
import { CURRENT_SDK } from "db://assets/scripts/parameter/config/PlayableConfig";
import { SdkType } from "db://assets/PlayableParamterTool/GameConfig";

/**
 * cta Service - Manages Call-To-Action logic for redirecting to store
 */
export class CTAService {
    private static _instance: CTAService = null;

    public static get instance(): CTAService {
        if (!this._instance) {
            this._instance = new CTAService();
        }
        return this._instance;
    }

    /**
     * Handle cta click - Auto select based on SDK type
     */
    public handleCTAClick(): void {
        const sdk: SdkType = CURRENT_SDK as SdkType;
        switch (sdk) {
            case SdkType.THE_ONE:
                gameEndHandler.StoreGameChangingNoCondition();
                break;
            case SdkType.VOODOO:
                ParameterManager.redirect();
                break;
            default:
                gameEndHandler.StoreGameChangingNoCondition();
                break;
        }
    }
}