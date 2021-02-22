#!/usr/bin/env node

const { spawn } = require("child_process");

const ndapp = require("ndapp");
const yargs = require("yargs/yargs");
const sharp = require("sharp");
const filenamify = require("filenamify");

async function executeShellCommand(cmd) {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, { shell: true });

		// child.stdout.on("data", data => app.log.info(data.toString()));
		// child.stderr.on("data", data => app.log.info(data.toString()));

		child.on("exit", exitCode => exitCode ? reject(new Error("Process exited with error code " + exitCode)) : resolve());
	});
}

const METADATA_HEADER = ";FFMETADATA1";

function parseMetadata(filePath) {
	return app.fs.readFileSync(filePath, { encoding: "utf-8" })
		.split("\n")
		.filter(line => line && line !== METADATA_HEADER)
		.map(line => line.split("="))
		.mapToObject(line => ({ key: line[0], value: line[1] }));
}

function formatMetadata(metadata) {
	return [METADATA_HEADER, ...metadata.mapToArray((key, value) => `${key}=${value}`)].join("\n");
}

ndapp(async () => {
	const { argv } = yargs(process.argv.slice(2))
		.usage(`${require("./package.json").name} скрипт для форматирования тэгов и структуры альбома`)
		.strict()
		.version(false)
		.option("input", {
			alias: "i",
			describe: "Папка с треками",
			type: "string",
			required: true,
			coerce: app.path.resolve
		})
		.option("output", {
			alias: "o",
			describe: "Результирующая папка",
			type: "string",
			required: true,
			coerce: app.path.resolve
		})
		.option("caseArtist", {
			alias: "ca",
			type: "boolean",
			description: "Использовать заглавные буквы в имени артиста",
			default: true
		})
		.option("artist", {
			type: "string",
			description: "Имя артиста"
		})
		.option("caseAlbum", {
			alias: "cl",
			type: "boolean",
			description: "Использовать заглавные буквы в имени альбома",
			default: true
		})
		.option("album", {
			type: "string",
			description: "Имя альбома"
		})
		.option("caseTitle", {
			alias: "ct",
			type: "boolean",
			description: "Использовать заглавные буквы в названии трека",
			default: true
		})
		.option("genre", {
			type: "string",
			description: "Жанр"
		})
		.option("year", {
			type: "number",
			description: "Год"
		})
		.option("coverSize", {
			alias: "cs",
			type: "number",
			description: "Размер обложки (строна в пикселях, обложка квадратная)",
			default: 500
		})
		.option("acronyms", {
			array: true,
			type: "string",
			description: "Акронимы, в которых не нужно менять регистр",
			default: ["OST", "EP", "LP", "feat"]
		});

	function nameCase(s) {
		return s.split(" ").filter(Boolean).map(word => !argv.acronyms.includes(word) ? app.libs._.capitalize(word) : word).join(" ");
	}

	const inputDirectory = argv.input;
	const outputDirectory = argv.output;
	const outputTempDirectory = app.path.join(outputDirectory, "temp");

	if (!app.fs.existsSync(inputDirectory)) throw new Error("No input directory");

	app.fs.removeSync(outputDirectory);
	app.fs.ensureDirSync(outputTempDirectory);

	let trackInfos = [];
	let coverProcessed = false;
	const coverResizedPath = app.path.join(outputTempDirectory, "coverResized.jpg");

	const files = app.fs.readdirSync(inputDirectory);
	for (let fileName of files) {
		const filePath = app.path.join(inputDirectory, fileName);
		const metadataFilePath = app.path.join(outputTempDirectory, fileName + ".txt");

		await executeShellCommand(`ffmpeg -i "${filePath}" -y -f ffmetadata "${metadataFilePath}"`);

		const metadata = parseMetadata(metadataFilePath);
		trackInfos.push({ filePath, metadata });

		if (!coverProcessed) {
			const coverTempPath = app.path.join(outputTempDirectory, "cover.jpg");
			await executeShellCommand(`ffmpeg -i "${filePath}" -y -an -vcodec copy "${coverTempPath}"`);
			if (app.fs.existsSync(coverTempPath)) {
				sharp(coverTempPath)
					.resize(argv.coverSize, argv.coverSize)
					.toFile(coverResizedPath);
			}

			coverProcessed = true;
		}
	}

	let artist = argv.artist;
	let album = argv.album;
	let genre = argv.genre;
	let year = argv.year;
	let trackTagsAmount = 0;

	trackInfos.forEach(info => {
		const metadata = info.metadata;
		if (!artist &&
			metadata.artist) {
			artist = argv.caseArtist ? nameCase(metadata.artist) : metadata.artist;
		}

		if (!album &&
			metadata.album) {
			album = argv.caseAlbum ? nameCase(metadata.album) : metadata.album;
		}

		if (!genre &&
			metadata.genre) {
			genre = metadata.genre;
		}

		if (!year &&
			metadata.date) {
			year = metadata.date;
		}

		if (metadata.track) {
			metadata.track = parseInt(metadata.track);
			trackTagsAmount++;
		}
	});

	if (!artist) throw new Error("No artist");
	if (!album) throw new Error("No album");
	if (trackTagsAmount > 0 &&
		trackTagsAmount !== trackInfos.length) throw new Error("Inconsistency track numbers");

	if (trackTagsAmount > 0) {
		trackInfos = app.libs._.sortBy(trackInfos, trackInfo => trackInfo.metadata.track);
	} else {
		trackInfos = app.libs._.sortBy(trackInfos, trackInfo => trackInfo.filePath);
	}

	trackInfos.forEach((trackInfo, index) => {
		trackInfo.metadata = {
			artist: artist,
			album: album,
			track: app.libs._.padStart((index + 1).toString(), 2, "0"),
			title: argv.caseTitle ? nameCase(trackInfo.metadata.title) : trackInfo.metadata.title
		};

		if (genre) {
			trackInfo.metadata.genre = genre;
		}

		if (year) {
			trackInfo.metadata.date = year;
		}
	});

	app.log.info(`${artist} - ${album} ${genre || ""} ${year || ""}`);

	const outputAlbumDirectory = app.path.join(outputDirectory, filenamify(artist), filenamify(album));
	app.fs.ensureDirSync(outputAlbumDirectory);

	app.fs.copySync(coverResizedPath, app.path.join(outputAlbumDirectory, "cover.jpg"));

	for (const trackInfo of trackInfos) {
		const outputFileName = `${trackInfo.metadata.track} ${filenamify(trackInfo.metadata.artist)} - ${filenamify(trackInfo.metadata.title)}.mp3`;
		const outputFilePath = app.path.join(outputAlbumDirectory, outputFileName);

		// Удаление всех тегов
		let inputTempFilePath = trackInfo.filePath;
		let outputTempFilePath = app.path.join(outputTempDirectory, trackInfo.metadata.track + "0.mp3");
		await executeShellCommand(`ffmpeg -i "${inputTempFilePath}" -y -vn -codec:a copy -map_metadata -1 "${outputTempFilePath}"`);

		// Перезапись тегов
		inputTempFilePath = outputTempFilePath;
		outputTempFilePath = app.path.join(outputTempDirectory, trackInfo.metadata.track + "1.mp3");
		let metadataFilePath = app.path.join(outputTempDirectory, "meta.txt");
		app.fs.writeFileSync(metadataFilePath, formatMetadata(trackInfo.metadata));
		await executeShellCommand(`ffmpeg -i "${inputTempFilePath}" -i "${metadataFilePath}" -y -vn -codec:a copy -map_metadata 1 -write_id3v2 1 "${outputTempFilePath}"`);

		// Запись картинки
		inputTempFilePath = outputTempFilePath;
		await executeShellCommand(`ffmpeg -i "${inputTempFilePath}" -i "${coverResizedPath}" -y -map 0:0 -map 1:0 -codec:a copy "${outputFilePath}"`);

		app.log.info(outputFileName);
	}

	app.fs.removeSync(outputTempDirectory);
});
