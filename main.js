#!/usr/bin/env node

const ndapp = require("ndapp");
const yargs = require("yargs/yargs");
const sharp = require("sharp");
const filenamify = require("filenamify");

const executeShellCommand = require("./src/executeShellCommand");
const { parseMetadata, formatMetadata } = require("./src/metadata");

const COVER_SIZE = 500;
const ACRONYMS = ["OST", "EP", "LP", "feat"];

ndapp(async () => {
	// eslint-disable-next-line no-unused-expressions
	yargs(process.argv.slice(2))
		.usage(`${require("./package.json").name} скрипт для форматирования тэгов и структуры альбома`)
		.strict()
		.version(false)
		.option("help", {
			describe: "Помощь"
		})
		.command("$0 <input> <output>", false, yargs => {
			yargs
				.strict()
				.positional("input", {
					describe: "Папка с треками",
					type: "string",
					coerce: app.path.resolve
				})
				.positional("output", {
					describe: "Результирующая папка",
					type: "string",
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
					default: COVER_SIZE
				})
				.option("acronyms", {
					array: true,
					type: "string",
					description: "Акронимы, в которых не нужно менять регистр",
					default: ACRONYMS
				});
		}, async argv => {
			function isLetter(s) {
				return s.length === 1 && s.toLowerCase() !== s.toUpperCase();
			}

			function nameCase(s) {
				let r = "";
				let word = "";

				const processWord = () => {
					if (word) {
						word = !argv.acronyms.includes(word) ? app.libs._.capitalize(word) : word;
						r += word;
						word = "";
					}
				};

				for (let i = 0; i < s.length; i++) {
					const c = s[i];
					if (isLetter(c)) {
						word += c;
					} else {
						processWord();

						r += c;
					}
				}

				processWord();

				return r;
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

			const files = app.fs.readdirSync(inputDirectory)
				.filter(fileName => fileName.toLowerCase().endsWith(".mp3"));

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
					genre = nameCase(metadata.genre);
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
		}).argv;
});
