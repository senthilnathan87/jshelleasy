const vscode = require("vscode");
const fs = require("fs");
const os = require("os");
const path = require("path");
const isWindows = os.platform() === "win32";

let sessionTempFile;
let lastSnippet;
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('"jshelleasy" is now active!');

  let panel;
  let changeEventOnEdit;
  let lastChangeVersion;
  let loaded = !isWindows;
  let cmd = "";
  let runJshellEasyCommand = vscode.commands.registerCommand(
    "extension.jshelleasy",
    () => {
      vscode.window.showInformationMessage(
        "Created a new file for JShell Easy"
      );
      var setting = vscode.Uri.parse("untitled:" + "snippets.jsh");
      vscode.workspace.openTextDocument(setting).then(
        document => {
          vscode.window.showTextDocument(document, 1, false).then(e => {
            e.edit(edit => {
              edit.insert(
                new vscode.Position(0, 0),
                "//JShell Easy Playground \n\n"
              );
            });
          });
        },
        error => {
          console.error(error);
          debugger;
        }
      );

      if (isWindows) {
        createTempFile("jshellrun.jsh");
      }
      vscode.window.setStatusBarMessage("Starting JShell Easy Session", 2000);
      if (!panel || panel._isDisposed) {
        panel = vscode.window.createWebviewPanel(
          "jshellEasy",
          "JShell Easy",
          vscode.ViewColumn.Two,
          {}
        );
      }
      panel.reveal(vscode.ViewColumn.Two);

      vscode.workspace.onDidChangeTextDocument(changeEvent => {
        if (changeEvent.document.uri.fsPath === "snippets.jsh") {
          changeEventOnEdit = changeEvent;
        }
      });

      vscode.workspace.onDidCloseTextDocument(document => {
        if (document.uri.fsPath === "snippets.jsh") {
          deactivate(panel);
        }
      });

      setInterval(() => {
        if (lastChangeVersion !== changeEventOnEdit.document.version) {
          lastChangeVersion = changeEventOnEdit.document.version;
          executeJshell(changeEventOnEdit.document);
        }
      }, 3000);

      // TODO: to use current active editor
      //   vscode.workspace
      //     .openTextDocument(vscode.window.activeTextEditor.document.uri)
      //     .then(document => executeJshell(document));

      function executeJshell(document) {
        if (!loaded) return;

        panel.webview.html;
        let text = document.getText();
        if (lastSnippet && text.trim() === lastSnippet.trim()) {
          return;
        }
        panel.webview.html = panel.webview.html.replace(
          "</html>",
          "<div style='font-size: 15px;'>Running.... </div></html>"
        );
        
        lastSnippet = text;
        text += "\n\n/exit";
        const cp = require("child_process");
        writeToTempFile(sessionTempFile, text)
          .then(() => {
            cp.exec(cmd, (err, stdout, stderr) => {
              let blocks = stdout.replace(/^\s*[\r\n]/gm, ""); //Remove Blank Lines
              blocks = blocks.replace(/^jshell> [\r\n]/gm, ""); //Remove jshell blank Lines

              panel.webview.html = generateHTML(blocks) + "</html>";

              if (err) {
                console.log("error: " + err);
              }
              if (stderr) {
                panel.webview.html =
                  "<html style='font-size: 15px;'> \
                        <div>Requirements are not met. Please check the following</div> <ul>\
                          <li>Jdk9+ is required</li> \
                          <li>jshell should be accessible globally</li> \
                        </ul></html>";
              }
            });
          })
          .catch(e => console.log("e", e));
      }

      function generateHTML(blocks) {
        let indBlocks = blocks.split(/jshell> /);
        let html =
          "<html> \
						<style> \
						pre {     \
							background: #3F51B5; \
							padding: 10px;\
							font-size: 16px;\
							font-family: monospace;\
							border-radius: 5px;}\
						pre.snip { background: #455A64; font-size: 13px; display: inline-block;}\
						pre.error{ background: #AD1457; font-size: 13px; display: inline-block;}</style>";
        let preblocks = "";
        indBlocks.forEach(code => {
          if (code.trim() !== "") {
            if (code.indexOf("Error") >= 0) {
              preblocks += "<div><pre class='error'>" + code + "</pre></div>";
            } else if (code.indexOf("==>") === -1) {
              preblocks += "<div><pre class='snip'>" + code + "</pre></div>";
            } else {
              preblocks += "<div><pre>" + code + "</pre></div>";
            }
          }
        });

        return html + preblocks;
      }

      function createTempFile(name) {
        const tempPath = path.join(os.tmpdir(), "jshellez-");
        let tempFilePath = "";
        fs.mkdtemp(tempPath, (err, folder) => {
          if (err) {
            console.log(err);
            return;
          }
          tempFilePath = path.join(folder, name);
          fs.writeFile(tempFilePath, "", "utf-8", errorFile => {
            if (errorFile) console.log(errorFile);
            return;
          });
          loaded = true;
          sessionTempFile = tempFilePath;
          if (isWindows) {
            cmd = "type " + sessionTempFile + " | jshell --feedback normal";
          } else {
            cmd = "cat " + sessionTempFile + " | jshell --feedback normal"; // Discontinued
          }
        });
      }

      function writeToTempFile(tempPath, data, encoding = "utf8") {
        if (!isWindows) {
          cmd = "printf '"
            .concat(data.replace(/'/g, "'\\''"))
            .concat("' | jshell --feedback normal");
          return Promise.resolve(data);
        }
        return new Promise(function(resolve, reject) {
          fs.writeFile(tempPath, data, encoding, errorFile => {
            if (errorFile) console.log(errorFile);
            reject();
            return;
          });
          resolve();
        });
      }
    }
  );

  context.subscriptions.push(runJshellEasyCommand);
  //   context.subscriptions.push(newJshellEasyCommand);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate(panel) {
  console.log("Cleanup");
  panel.dispose();
  if (isWindows) {
    fs.unlink(sessionTempFile, err => console.log(err));
  }
  lastSnippet = undefined;
  sessionTempFile = undefined;
}

module.exports = {
  activate,
  deactivate
};
