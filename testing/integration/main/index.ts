import * as path from "path";

import { glob } from "glob";
import Mocha from "mocha";

export const run = (): Promise<void> => {
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
  });

  const testsRoot = path.resolve(__dirname, ".");

  return new Promise((resolve, reject) => {
    glob("**/*.test.js", { cwd: testsRoot })
      .then((files) => {
        files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

        mocha.run((failures) => {
          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        });
      })
      .catch(reject);
  });
};
