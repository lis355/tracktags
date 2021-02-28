const { spawn } = require("child_process");

module.exports = async function executeShellCommand(cmd) {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, { shell: true });

		// child.stdout.on("data", data => app.log.info(data.toString()));
		// child.stderr.on("data", data => app.log.info(data.toString()));

		child.on("exit", exitCode => exitCode ? reject(new Error("Process exited with error code " + exitCode)) : resolve());
	});
};
