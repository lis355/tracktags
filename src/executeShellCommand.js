const { spawn } = require("child_process");

module.exports = async function executeShellCommand(cmd) {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, { shell: true });

		child.on("exit", exitCode => exitCode ? reject(new Error("Process exited with error code " + exitCode)) : resolve());
	});
};
