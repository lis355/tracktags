const METADATA_HEADER = ";FFMETADATA1";
const NEW_LINE = "\n";

function parseMetadata(filePath) {
	return app.fs.readFileSync(filePath, { encoding: "utf-8" })
		.split(NEW_LINE)
		.filter(line => line && line !== METADATA_HEADER)
		.map(line => line.split("="))
		.mapToObject(line => ({ key: line[0], value: line[1] }));
}

function formatMetadata(metadata) {
	return [METADATA_HEADER, ...metadata.mapToArray((key, value) => `${key}=${value}`)].join(NEW_LINE) + NEW_LINE;
}

module.exports = {
	parseMetadata,
	formatMetadata
};
