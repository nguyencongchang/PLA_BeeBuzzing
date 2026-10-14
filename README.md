# CocosPlayableAdsTemplate

## Introduction

This project is designed to help you easily set up a playable ads for mutil platform. Follow the instructions below to get started.

After create new playable ads game project from this template, please:

### In your project

1. On Windows, run `SetupProject.bat` as Administrator. On macOS, run:

```bash
./SetupProject.sh
```

<img width="234" alt="image" src="https://user-images.githubusercontent.com/9598614/219407739-964fae3d-e693-447b-bb8b-719d60ceaf86.png">

2. You will see this ternimal windows, enter to continue

### In your project

## Step 1: Add Condition in IsChangeToLinkStore Method

1. Setup  `GameManager.instance.SetupManagerInit();` on `Onload()` method in your class.
2. Locate the `IsChangeToLinkStore()` method.
3. Add your custom condition within the method.

Example:

```typescript

protected onLoad(): void {
    GameManager.instance.SetupManagerInit();
}

protected update(dt: number): void {
    GameEndHandler.StoreGameChanging(this.IsChangeToLinkStore());
}

public IsChangeToLinkStore(): boolean {
    // Your custom condition here
    if (/* your condition */) {
        return true;
    }
    return false;
}
```

## Step 2: Change SRORE_LINK, Audio and Effect constant

1. Open the file `.\constant.ts`.
2. Modify the `SRORE_LINK` , `AUDIO_NAME` and `EFFECT_NAME` variables to your variables.

Example:

```typescript
export class Constant {
    static SRORE_LINK = {
        ANDROID_LINK: 'https://play.google.com/',
        IOS_LINK: 'https://apps.apple.com/',
    }

    static AUDIO_NAME = {
        MUSIC_TEST: 'music_ex',     
        SOUND_TEST: 'sound_ex',  
    }

    static EFFECT_NAME = {
        EFFECT_TEST: 'effect_ex' 
    }
}
```
