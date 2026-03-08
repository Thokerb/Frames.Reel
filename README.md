# Reel

Reel is a Langium based DSL, which allows state based modeling of parallel [DEVS](https://en.wikipedia.org/wiki/DEVS).

## Getting started

```
# Set up Node.js
uses: actions/setup-node@v4
with:
    node-version: '20'

# Install dependencies
run: npm install

# Install VSCE
run: npm install -g @vscode/vsce

# Build Grammar
run: npm run langium:generate:production

# Build DSL
run: npm run build
```

## Build Artifacts

```
# Build worker script
npm run build:worker

# Build extension
npm run package
```

Worker script is a javascript web worker, which can be used in embeddeed editors as shown in the Frames.WebApp

Extension is a .vsix VS-Code extension, which can be directly installed in VS Code, by simply right-clicking it in VS-Code.

## Using Reel with installed Plugin in VS Code

Simply create a new ".reel" file. The plugin should automatically apply.

Exporting json: Open Command Palette (strg + shift + p) and select command "Generate JSON from Reel". This will open a new window with the generated json.

## Developing Langium

It is strongly recommended to use VS-Code. Checkout [Langium Quickstart](langium-quickstart.md) for more information.


## Project Structure

* /example: contains various .reel examples
* /src/language/reel.langium: Grammar definition
* /src/language/reel-validator.ts: Live validation
* /src/reel-scope: Extended scope provider; this is necessary because in some cases we dont want the complete scope or it is not possible only based on grammar to define scope.
* /src/reel-expression-checker.ts: Helper functions
* /src/reel-infer.ts: Helper functions
* /src/code-generation/json: This contains the json code generation code