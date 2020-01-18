const vscode = require("vscode");
const fs = require("fs");
const os = require("os");
const path = require("path");
let sessionTempFile;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('"jshelleasy" is now active!');

  let panel;
  let changeEventOnEdit;
  let lastChangeVersion;
  let loaded = false;

  let runJshellEasyCommand = vscode.commands.registerCommand(
    "extension.jshelleasy",
    function() {
      vscode.window.showInformationMessage(
        "Created a new file for JShell Easy"
      );
      var setting = vscode.Uri.parse("untitled:" + "snippets.java");
      vscode.workspace.openTextDocument(setting).then(
        document => {
          vscode.window.showTextDocument(document, 1, false).then(e => {
            e.edit(edit => {
              edit.insert(new vscode.Position(0, 0), "5 + 10");
            });
          });
        },
        error => {
          console.error(error);
          debugger;
        }
      );

      createTempFile("jshellrun.jsh");
      vscode.window.setStatusBarMessage(
        "Starting JShell inline to the current active file",
        2000
      );
      if (!panel) {
        panel = vscode.window.createWebviewPanel(
          "jshellEasy",
          "JShell Easy",
          vscode.ViewColumn.Two,
          {}
        );
      }
      panel.reveal(vscode.ViewColumn.Two);

      vscode.workspace.onDidChangeTextDocument(changeEvent => {
        changeEventOnEdit = changeEvent;
      });

      setInterval(function() {
        if (lastChangeVersion !== changeEventOnEdit.document.version) {
          lastChangeVersion = changeEventOnEdit.document.version;
          executeJshell(changeEventOnEdit.document);
        }
      }, 3000);

      //   vscode.workspace
      //     .openTextDocument(vscode.window.activeTextEditor.document.uri)
      //     .then(document => executeJshell(document));

      function executeJshell(document) {
        if (!loaded) return;

        //panel.webview.html = "<html>Running...</html>";
        // if (panel.webview.html.indexOf(">Running....") === -1) {
          panel.webview.html = panel.webview.html.replace(
            "</html>",
            "<div style='font-size: 15px;'>Running.... </div></html>"
          );
        // }
        panel.webview.html;
        let text = document.getText() + "\n /exit";
        const cp = require("child_process");
        writeToTempFile(sessionTempFile, text.replace(/(^[ \t]*\n)/gm, ""))
          .then(() => {
            let cmd = "cat " + sessionTempFile + " | jshell ";
            cp.exec(cmd, (err, stdout, stderr) => {
              let blocks = stdout
                .split("\n")
                .slice(2)
                .join("\n");
              blocks = blocks.replace(/jshell> /g, "");

              panel.webview.html = generateHTML(blocks) + "</html>";

              if (err) {
                console.log("error: " + err);
              }
              if (stderr) {
                console.log("error: " + stderr);
              }
            });

            //   fs.unlink(sessionTempFile, err => console.log(err)); //cleanup
          })
          .catch(e => console.log("e", e));
      }

      function generateHTML(blocks) {
        let indBlocks = blocks.split("\n\n");
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
          if (code !== "") {
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
        });
      }

      function writeToTempFile(tempPath, data, encoding = "utf8") {
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

  //   let newJshellEasyCommand = vscode.commands.registerCommand(
  //     "extension.jshelleasy.new",
  //     function() {

  //     }
  //   );

  context.subscriptions.push(runJshellEasyCommand);
  //   context.subscriptions.push(newJshellEasyCommand);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
    console.log("Cleanup")
    fs.unlink(sessionTempFile, err => console.log(err));
}

module.exports = {
  activate,
  deactivate
};
