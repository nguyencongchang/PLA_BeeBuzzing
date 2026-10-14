"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs").promises;
const path = require("path");
const readline = require("readline");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});


function getCurrentDirectory() {
  return __dirname;
}

async function getJsonData(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf8");
    const jsonData = JSON.parse(data);
    return jsonData;
  } catch (error) {
    console.error("Error reading or parsing the JSON file:", error);
  }
}

async function updateJsonFile(filePath, jsData) {
  try {
    let jsonData = await getJsonData(filePath);

    jsonData.name = jsData.name;

    const updatedJsonData = JSON.stringify(jsonData, null, 2);

    await fs.writeFile(filePath, updatedJsonData, "utf8");
    console.log("File has been updated");
  } catch (err) {
    console.error("Error:", err);
  }
}

async function updatePackageLog(filePath, jsData) {
    try {
      let jsonData = await getJsonData(filePath);
  
      jsonData.name = jsData.name;

      if (jsonData.packages && jsonData.packages[""]) {
        jsonData.packages[""].name = jsData.name;
    }
      const updatedJsonData = JSON.stringify(jsonData, null, 2);
  
      await fs.writeFile(filePath, updatedJsonData, "utf8");
      console.log("File has been updated");
    } catch (err) {
      console.error("Error:", err);
    }
  }

function getChildDirectory(parentDir, childFolder) {
    return path.join(parentDir, childFolder);
}

function getPackagePath(parentPath, packagePath) {
    // path.join dùng separator đúng theo OS (Windows \ , macOS/Linux /) — cross-platform.
    return path.join(getCurrentDirectory(), parentPath, packagePath);
}

async function setUp(name) {
    console.log();
  const updateData = {
    name: name,
  };

  await updateJsonFile(
    getPackagePath(name,'package.json'),
    updateData
  );

  await updatePackageLog(
    getPackagePath(name,'package-lock.json'),
    updateData
  );
  await updateJsonFile(
    getPackagePath('ci', 'cocos-build.json'),
    updateData
  );
  process.exit(0);
}

const args = process.argv.slice(2);
const input = args[0]; 
setUp(input);
