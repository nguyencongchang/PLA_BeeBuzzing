@echo off
cd /d %~dp0
for %%a in ("%~dp0\.") do set "parent=%%~nxa"
set CocosProjectName=Cocos%parent%

title TCMPlay Setup Script
echo Welcome to TCMPlay setup pipeline!
echo This script will:
echo 1. Change cocos project name to %CocosProjectName%
echo 2. Update submodule
echo 3. Install npm dependencies
pause
setlocal

@REM Remove old submodule
git rm CocosPlayableAdsTemplate/assets/PLAGameFoundation
git rm CocosPlayableAdsTemplate/assets/PlayableParamterTool
git rm CocosPlayableAdsTemplate/tools/optimize-size

@REM Rename Cocos Project
ren CocosPlayableAdsTemplate %CocosProjectName%

@REM Run Node.js script with the new project name as a parameter
cmd /c "node setup.js %CocosProjectName%"

@REM Install npm dependencies (project + editor extension super-html)
echo Installing npm dependencies...
cd %CocosProjectName%
cmd /c "npm install"
@REM super-html editor extension needs its own deps (jszip, cheerio, vue...) else panel fails "Cannot find module 'jszip'"
if exist extensions\super-html (
  cd extensions\super-html
  cmd /c "npm install"
  cd ..\..
)
cd ..

@REM RE-Add submodule
git submodule add git@github.com:nguyencongchang/tcm-PLAGameFoundation.git %CocosProjectName%/assets/PLAGameFoundation

git submodule add git@github.com:nguyencongchang/tcm-PlayableParamterTool.git %CocosProjectName%/assets/PlayableParamterTool

git submodule add git@github.com:nguyencongchang/tcm-optimize-size.git %CocosProjectName%/tools/optimize-size

git submodule foreach git switch develop
