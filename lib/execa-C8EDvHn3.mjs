import fs, { appendFileSync, closeSync, createReadStream, createWriteStream, openSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { aborted, callbackify, debuglog, inspect, promisify, stripVTControlCharacters } from "node:util";
import { ChildProcess, execFile, spawn, spawnSync } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import process$1, { execArgv, execPath, hrtime, platform } from "node:process";
import tty from "node:tty";
import { scheduler, setImmediate, setTimeout } from "node:timers/promises";
import { constants } from "node:os";
import { EventEmitter, addAbortListener, on, once, setMaxListeners } from "node:events";
import { serialize } from "node:v8";
import { Buffer } from "node:buffer";
import { Duplex, PassThrough, Readable, Transform, Writable, getDefaultHighWaterMark } from "node:stream";
import { finished } from "node:stream/promises";
import path$1 from "node:path/win32";

//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/is-plain-obj@4.1.0/node_modules/is-plain-obj/index.js
function isPlainObject(value) {
	if (typeof value !== "object" || value === null) return false;
	const prototype = Object.getPrototypeOf(value);
	return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in value) && !(Symbol.iterator in value);
}

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/arguments/file-url.js
const safeNormalizeFileUrl = (file, name) => {
	const fileString = normalizeFileUrl(normalizeDenoExecPath(file));
	if (typeof fileString !== "string") throw new TypeError(`${name} must be a string or a file URL: ${fileString}.`);
	return fileString;
};
const normalizeDenoExecPath = (file) => isDenoExecPath(file) ? file.toString() : file;
const isDenoExecPath = (file) => typeof file !== "string" && file && Object.getPrototypeOf(file) === String.prototype;
const normalizeFileUrl = (file) => file instanceof URL ? fileURLToPath(file) : file;

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/methods/parameters.js
const normalizeParameters = (rawFile, rawArguments = [], rawOptions = {}) => {
	const filePath = safeNormalizeFileUrl(rawFile, "First argument");
	const [commandArguments, options] = isPlainObject(rawArguments) ? [[], rawArguments] : [rawArguments, rawOptions];
	if (!Array.isArray(commandArguments)) throw new TypeError(`Second argument must be either an array of arguments or an options object: ${commandArguments}`);
	if (commandArguments.some((commandArgument) => typeof commandArgument === "object" && commandArgument !== null)) throw new TypeError(`Second argument must be an array of strings: ${commandArguments}`);
	const normalizedArguments = commandArguments.map(String);
	const nullByteArgument = normalizedArguments.find((normalizedArgument) => normalizedArgument.includes("\0"));
	if (nullByteArgument !== void 0) throw new TypeError(`Arguments cannot contain null bytes ("\\0"): ${nullByteArgument}`);
	if (!isPlainObject(options)) throw new TypeError(`Last argument must be an options object: ${options}`);
	return [
		filePath,
		normalizedArguments,
		{
			__proto__: null,
			...options
		}
	];
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/utils/uint-array.js
const { toString: objectToString$1 } = Object.prototype;
const isArrayBuffer = (value) => objectToString$1.call(value) === "[object ArrayBuffer]";
const isUint8Array = (value) => objectToString$1.call(value) === "[object Uint8Array]";
const bufferToUint8Array = (buffer) => new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
const textEncoder$1 = new TextEncoder();
const stringToUint8Array = (string) => textEncoder$1.encode(string);
const textDecoder = new TextDecoder();
const uint8ArrayToString = (uint8Array) => textDecoder.decode(uint8Array);
const joinToString = (uint8ArraysOrStrings, encoding) => {
	return uint8ArraysToStrings(uint8ArraysOrStrings, encoding).join("");
};
const uint8ArraysToStrings = (uint8ArraysOrStrings, encoding) => {
	if (encoding === "utf8" && uint8ArraysOrStrings.every((uint8ArrayOrString) => typeof uint8ArrayOrString === "string")) return uint8ArraysOrStrings;
	const decoder = new StringDecoder(encoding);
	const strings = uint8ArraysOrStrings.map((uint8ArrayOrString) => typeof uint8ArrayOrString === "string" ? stringToUint8Array(uint8ArrayOrString) : uint8ArrayOrString).map((uint8Array) => decoder.write(uint8Array));
	const finalString = decoder.end();
	return finalString === "" ? strings : [...strings, finalString];
};
const joinToUint8Array = (uint8ArraysOrStrings) => {
	if (uint8ArraysOrStrings.length === 1 && isUint8Array(uint8ArraysOrStrings[0])) return uint8ArraysOrStrings[0];
	return concatUint8Arrays(stringsToUint8Arrays(uint8ArraysOrStrings));
};
const stringsToUint8Arrays = (uint8ArraysOrStrings) => uint8ArraysOrStrings.map((uint8ArrayOrString) => typeof uint8ArrayOrString === "string" ? stringToUint8Array(uint8ArrayOrString) : uint8ArrayOrString);
const concatUint8Arrays = (uint8Arrays) => {
	const result = new Uint8Array(getJoinLength(uint8Arrays));
	let index = 0;
	for (const uint8Array of uint8Arrays) {
		result.set(uint8Array, index);
		index += uint8Array.length;
	}
	return result;
};
const getJoinLength = (uint8Arrays) => {
	let joinLength = 0;
	for (const uint8Array of uint8Arrays) joinLength += uint8Array.length;
	return joinLength;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/methods/template.js
const isTemplateString = (templates) => Array.isArray(templates) && Array.isArray(templates.raw);
const parseTemplates = (templates, expressions) => {
	let tokens = [];
	for (const [index, template] of templates.entries()) tokens = parseTemplate({
		templates,
		expressions,
		tokens,
		index,
		template
	});
	if (tokens.length === 0) throw new TypeError("Template script must not be empty");
	const [file, ...commandArguments] = tokens;
	return [
		file,
		commandArguments,
		{}
	];
};
const parseTemplate = ({ templates, expressions, tokens, index, template }) => {
	if (template === void 0) throw new TypeError(`Invalid backslash sequence: ${templates.raw[index]}`);
	const { nextTokens, leadingWhitespaces, trailingWhitespaces } = splitByWhitespaces(template, templates.raw[index]);
	const newTokens = concatTokens(tokens, nextTokens, leadingWhitespaces);
	if (index === expressions.length) return newTokens;
	const expression = expressions[index];
	return concatTokens(newTokens, Array.isArray(expression) ? expression.map((expression) => parseExpression(expression)) : [parseExpression(expression)], trailingWhitespaces);
};
const splitByWhitespaces = (template, rawTemplate) => {
	if (rawTemplate.length === 0) return {
		nextTokens: [],
		leadingWhitespaces: false,
		trailingWhitespaces: false
	};
	const nextTokens = [];
	let templateStart = 0;
	const isLeadingWhitespaces = DELIMITERS.has(rawTemplate[0]);
	for (let templateIndex = 0, rawIndex = 0; templateIndex < template.length; templateIndex += 1, rawIndex += 1) {
		const rawCharacter = rawTemplate[rawIndex];
		if (DELIMITERS.has(rawCharacter)) {
			if (templateStart !== templateIndex) nextTokens.push(template.slice(templateStart, templateIndex));
			templateStart = templateIndex + 1;
		} else if (rawCharacter === "\\") {
			const nextRawCharacter = rawTemplate[rawIndex + 1];
			if (nextRawCharacter === "\n") {
				templateIndex -= 1;
				rawIndex += 1;
			} else if (nextRawCharacter === "u" && rawTemplate[rawIndex + 2] === "{") rawIndex = rawTemplate.indexOf("}", rawIndex + 3);
			else rawIndex += ESCAPE_LENGTH[nextRawCharacter] ?? 1;
		}
	}
	const isTrailingWhitespaces = templateStart === template.length;
	if (!isTrailingWhitespaces) nextTokens.push(template.slice(templateStart));
	return {
		nextTokens,
		leadingWhitespaces: isLeadingWhitespaces,
		trailingWhitespaces: isTrailingWhitespaces
	};
};
const DELIMITERS = new Set([
	" ",
	"	",
	"\r",
	"\n"
]);
const ESCAPE_LENGTH = {
	x: 3,
	u: 5
};
const concatTokens = (tokens, nextTokens, isSeparated) => isSeparated || tokens.length === 0 || nextTokens.length === 0 ? [...tokens, ...nextTokens] : [
	...tokens.slice(0, -1),
	`${tokens.at(-1)}${nextTokens[0]}`,
	...nextTokens.slice(1)
];
const parseExpression = (expression) => {
	const typeOfExpression = typeof expression;
	if (typeOfExpression === "string") return expression;
	if (typeOfExpression === "number") return String(expression);
	if (isPlainObject(expression) && ("stdout" in expression || "isMaxBuffer" in expression)) return getSubprocessResult(expression);
	if (expression instanceof ChildProcess || Object.prototype.toString.call(expression) === "[object Promise]") throw new TypeError("Unexpected subprocess in template expression. Please use ${await subprocess} instead of ${subprocess}.");
	throw new TypeError(`Unexpected "${typeOfExpression}" in template expression`);
};
const getSubprocessResult = ({ stdout }) => {
	if (typeof stdout === "string") return stdout;
	if (isUint8Array(stdout)) return uint8ArrayToString(stdout);
	if (stdout === void 0) throw new TypeError("Missing result.stdout in template expression. This is probably due to the previous subprocess' \"stdout\" option.");
	throw new TypeError(`Unexpected "${typeof stdout}" stdout in template expression`);
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/utils/standard-stream.js
const isStandardStream = (stream) => STANDARD_STREAMS.includes(stream);
const STANDARD_STREAMS = [
	process$1.stdin,
	process$1.stdout,
	process$1.stderr
];
const STANDARD_STREAMS_ALIASES = [
	"stdin",
	"stdout",
	"stderr"
];
const getStreamName = (fdNumber) => STANDARD_STREAMS_ALIASES[fdNumber] ?? `stdio[${fdNumber}]`;

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/arguments/specific.js
const normalizeFdSpecificOptions = (options) => {
	const optionsCopy = { ...options };
	for (const optionName of FD_SPECIFIC_OPTIONS) optionsCopy[optionName] = normalizeFdSpecificOption(options, optionName);
	return optionsCopy;
};
const normalizeFdSpecificOption = (options, optionName) => {
	const stdioLength = getStdioLength(options);
	const optionBaseArray = Array.from({ length: stdioLength + 1 });
	return addDefaultValue$1(normalizeFdSpecificValue(options[optionName], optionBaseArray, optionName, stdioLength), optionName);
};
const getStdioLength = ({ stdio }) => Array.isArray(stdio) ? Math.max(stdio.length, STANDARD_STREAMS_ALIASES.length) : STANDARD_STREAMS_ALIASES.length;
const normalizeFdSpecificValue = (optionValue, optionArray, optionName, stdioLength) => isPlainObject(optionValue) ? normalizeOptionObject(optionValue, optionArray, optionName, stdioLength) : optionArray.fill(optionValue);
const normalizeOptionObject = (optionValue, optionArray, optionName, stdioLength) => {
	for (const fdName of Object.keys(optionValue).sort(compareFdName)) for (const fdNumber of parseFdName(fdName, optionName, stdioLength)) optionArray[fdNumber] = optionValue[fdName];
	return optionArray;
};
const compareFdName = (fdNameA, fdNameB) => getFdNameOrder(fdNameA) < getFdNameOrder(fdNameB) ? 1 : -1;
const getFdNameOrder = (fdName) => {
	if (fdName === "stdout" || fdName === "stderr") return 0;
	return fdName === "all" ? 2 : 1;
};
const parseFdName = (fdName, optionName, stdioLength) => {
	if (fdName === "ipc") return [stdioLength];
	const fdNumber = parseFd(fdName);
	if (fdNumber === void 0 || fdNumber === 0) throw new TypeError(`"${optionName}.${fdName}" is invalid.
It must be "${optionName}.stdout", "${optionName}.stderr", "${optionName}.all", "${optionName}.ipc", or "${optionName}.fd3", "${optionName}.fd4" (and so on).`);
	if (fdNumber !== "all" && fdNumber >= stdioLength) throw new TypeError(`"${optionName}.${fdName}" is invalid: that file descriptor does not exist.
Please set the "stdio" option to ensure that file descriptor exists.`);
	return fdNumber === "all" ? [1, 2] : [fdNumber];
};
const parseFd = (fdName) => {
	if (fdName === "all") return fdName;
	if (STANDARD_STREAMS_ALIASES.includes(fdName)) return STANDARD_STREAMS_ALIASES.indexOf(fdName);
	const regexpResult = FD_REGEXP.exec(fdName);
	if (regexpResult !== null) return Number(regexpResult.groups.fdNumber);
};
const FD_REGEXP = /^fd(?<fdNumber>\d+)$/;
const addDefaultValue$1 = (optionArray, optionName) => optionArray.map((optionValue) => optionValue === void 0 ? DEFAULT_OPTIONS[optionName] : optionValue);
const DEFAULT_OPTIONS = {
	lines: false,
	buffer: true,
	maxBuffer: 1e3 * 1e3 * 100,
	verbose: debuglog("execa").enabled ? "full" : "none",
	stripFinalNewline: true
};
const FD_SPECIFIC_OPTIONS = [
	"lines",
	"buffer",
	"maxBuffer",
	"verbose",
	"stripFinalNewline"
];
const getFdSpecificValue = (optionArray, fdNumber) => fdNumber === "ipc" ? optionArray.at(-1) : optionArray[fdNumber];

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/verbose/values.js
const isVerbose = ({ verbose }, fdNumber) => getFdVerbose(verbose, fdNumber) !== "none";
const isFullVerbose = ({ verbose }, fdNumber) => !["none", "short"].includes(getFdVerbose(verbose, fdNumber));
const getVerboseFunction = ({ verbose }, fdNumber) => {
	const fdVerbose = getFdVerbose(verbose, fdNumber);
	return isVerboseFunction(fdVerbose) ? fdVerbose : void 0;
};
const getFdVerbose = (verbose, fdNumber) => fdNumber === void 0 ? getFdGenericVerbose(verbose) : getFdSpecificValue(verbose, fdNumber);
const getFdGenericVerbose = (verbose) => verbose.find((fdVerbose) => isVerboseFunction(fdVerbose)) ?? VERBOSE_VALUES.findLast((fdVerbose) => verbose.includes(fdVerbose));
const isVerboseFunction = (fdVerbose) => typeof fdVerbose === "function";
const VERBOSE_VALUES = [
	"none",
	"short",
	"full"
];

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/arguments/escape.js
const joinCommand = (filePath, rawArguments) => {
	const fileAndArguments = [filePath, ...rawArguments];
	return {
		command: fileAndArguments.join(" "),
		escapedCommand: fileAndArguments.map((fileAndArgument) => quoteString(escapeControlCharacters(fileAndArgument))).join(" ")
	};
};
const escapeLines = (lines) => stripVTControlCharacters(lines).split("\n").map((line) => escapeControlCharacters(line)).join("\n");
const escapeControlCharacters = (line) => line.replaceAll(SPECIAL_CHAR_REGEXP, (character) => escapeControlCharacter(character));
const escapeControlCharacter = (character) => {
	const commonEscape = COMMON_ESCAPES[character];
	if (commonEscape !== void 0) return commonEscape;
	const codepoint = character.codePointAt(0);
	const codepointHex = codepoint.toString(16);
	return codepoint <= ASTRAL_START ? `\\u${codepointHex.padStart(4, "0")}` : `\\U${codepointHex}`;
};
const getSpecialCharRegExp = () => {
	try {
		return /* @__PURE__ */ new RegExp("\\p{Separator}|\\p{Other}", "gu");
	} catch {
		return /[\s\u0000-\u001F\u007F-\u009F\u00AD]/g;
	}
};
const SPECIAL_CHAR_REGEXP = getSpecialCharRegExp();
const COMMON_ESCAPES = {
	" ": " ",
	"\b": "\\b",
	"\f": "\\f",
	"\n": "\\n",
	"\r": "\\r",
	"	": "\\t"
};
const ASTRAL_START = 65535;
const quoteString = (escapedArgument) => {
	if (NO_ESCAPE_REGEXP.test(escapedArgument)) return escapedArgument;
	return platform === "win32" ? `"${escapedArgument.replaceAll("\"", "\"\"")}"` : `'${escapedArgument.replaceAll("'", "'\\''")}'`;
};
const NO_ESCAPE_REGEXP = /^[\w\-./]+$/;

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/is-unicode-supported@2.1.0/node_modules/is-unicode-supported/index.js
function isUnicodeSupported() {
	const { env } = process$1;
	const { TERM, TERM_PROGRAM } = env;
	if (process$1.platform !== "win32") return TERM !== "linux";
	return Boolean(env.WT_SESSION) || Boolean(env.TERMINUS_SUBLIME) || env.ConEmuTask === "{cmd::Cmder}" || TERM_PROGRAM === "Terminus-Sublime" || TERM_PROGRAM === "vscode" || TERM === "xterm-256color" || TERM === "alacritty" || TERM === "rxvt-unicode" || TERM === "rxvt-unicode-256color" || env.TERMINAL_EMULATOR === "JetBrains-JediTerm";
}

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/figures@6.1.0/node_modules/figures/index.js
const common = {
	circleQuestionMark: "(?)",
	questionMarkPrefix: "(?)",
	square: "█",
	squareDarkShade: "▓",
	squareMediumShade: "▒",
	squareLightShade: "░",
	squareTop: "▀",
	squareBottom: "▄",
	squareLeft: "▌",
	squareRight: "▐",
	squareCenter: "■",
	bullet: "●",
	dot: "․",
	ellipsis: "…",
	pointerSmall: "›",
	triangleUp: "▲",
	triangleUpSmall: "▴",
	triangleDown: "▼",
	triangleDownSmall: "▾",
	triangleLeftSmall: "◂",
	triangleRightSmall: "▸",
	home: "⌂",
	heart: "♥",
	musicNote: "♪",
	musicNoteBeamed: "♫",
	arrowUp: "↑",
	arrowDown: "↓",
	arrowLeft: "←",
	arrowRight: "→",
	arrowLeftRight: "↔",
	arrowUpDown: "↕",
	almostEqual: "≈",
	notEqual: "≠",
	lessOrEqual: "≤",
	greaterOrEqual: "≥",
	identical: "≡",
	infinity: "∞",
	subscriptZero: "₀",
	subscriptOne: "₁",
	subscriptTwo: "₂",
	subscriptThree: "₃",
	subscriptFour: "₄",
	subscriptFive: "₅",
	subscriptSix: "₆",
	subscriptSeven: "₇",
	subscriptEight: "₈",
	subscriptNine: "₉",
	oneHalf: "½",
	oneThird: "⅓",
	oneQuarter: "¼",
	oneFifth: "⅕",
	oneSixth: "⅙",
	oneEighth: "⅛",
	twoThirds: "⅔",
	twoFifths: "⅖",
	threeQuarters: "¾",
	threeFifths: "⅗",
	threeEighths: "⅜",
	fourFifths: "⅘",
	fiveSixths: "⅚",
	fiveEighths: "⅝",
	sevenEighths: "⅞",
	line: "─",
	lineBold: "━",
	lineDouble: "═",
	lineDashed0: "┄",
	lineDashed1: "┅",
	lineDashed2: "┈",
	lineDashed3: "┉",
	lineDashed4: "╌",
	lineDashed5: "╍",
	lineDashed6: "╴",
	lineDashed7: "╶",
	lineDashed8: "╸",
	lineDashed9: "╺",
	lineDashed10: "╼",
	lineDashed11: "╾",
	lineDashed12: "−",
	lineDashed13: "–",
	lineDashed14: "‐",
	lineDashed15: "⁃",
	lineVertical: "│",
	lineVerticalBold: "┃",
	lineVerticalDouble: "║",
	lineVerticalDashed0: "┆",
	lineVerticalDashed1: "┇",
	lineVerticalDashed2: "┊",
	lineVerticalDashed3: "┋",
	lineVerticalDashed4: "╎",
	lineVerticalDashed5: "╏",
	lineVerticalDashed6: "╵",
	lineVerticalDashed7: "╷",
	lineVerticalDashed8: "╹",
	lineVerticalDashed9: "╻",
	lineVerticalDashed10: "╽",
	lineVerticalDashed11: "╿",
	lineDownLeft: "┐",
	lineDownLeftArc: "╮",
	lineDownBoldLeftBold: "┓",
	lineDownBoldLeft: "┒",
	lineDownLeftBold: "┑",
	lineDownDoubleLeftDouble: "╗",
	lineDownDoubleLeft: "╖",
	lineDownLeftDouble: "╕",
	lineDownRight: "┌",
	lineDownRightArc: "╭",
	lineDownBoldRightBold: "┏",
	lineDownBoldRight: "┎",
	lineDownRightBold: "┍",
	lineDownDoubleRightDouble: "╔",
	lineDownDoubleRight: "╓",
	lineDownRightDouble: "╒",
	lineUpLeft: "┘",
	lineUpLeftArc: "╯",
	lineUpBoldLeftBold: "┛",
	lineUpBoldLeft: "┚",
	lineUpLeftBold: "┙",
	lineUpDoubleLeftDouble: "╝",
	lineUpDoubleLeft: "╜",
	lineUpLeftDouble: "╛",
	lineUpRight: "└",
	lineUpRightArc: "╰",
	lineUpBoldRightBold: "┗",
	lineUpBoldRight: "┖",
	lineUpRightBold: "┕",
	lineUpDoubleRightDouble: "╚",
	lineUpDoubleRight: "╙",
	lineUpRightDouble: "╘",
	lineUpDownLeft: "┤",
	lineUpBoldDownBoldLeftBold: "┫",
	lineUpBoldDownBoldLeft: "┨",
	lineUpDownLeftBold: "┥",
	lineUpBoldDownLeftBold: "┩",
	lineUpDownBoldLeftBold: "┪",
	lineUpDownBoldLeft: "┧",
	lineUpBoldDownLeft: "┦",
	lineUpDoubleDownDoubleLeftDouble: "╣",
	lineUpDoubleDownDoubleLeft: "╢",
	lineUpDownLeftDouble: "╡",
	lineUpDownRight: "├",
	lineUpBoldDownBoldRightBold: "┣",
	lineUpBoldDownBoldRight: "┠",
	lineUpDownRightBold: "┝",
	lineUpBoldDownRightBold: "┡",
	lineUpDownBoldRightBold: "┢",
	lineUpDownBoldRight: "┟",
	lineUpBoldDownRight: "┞",
	lineUpDoubleDownDoubleRightDouble: "╠",
	lineUpDoubleDownDoubleRight: "╟",
	lineUpDownRightDouble: "╞",
	lineDownLeftRight: "┬",
	lineDownBoldLeftBoldRightBold: "┳",
	lineDownLeftBoldRightBold: "┯",
	lineDownBoldLeftRight: "┰",
	lineDownBoldLeftBoldRight: "┱",
	lineDownBoldLeftRightBold: "┲",
	lineDownLeftRightBold: "┮",
	lineDownLeftBoldRight: "┭",
	lineDownDoubleLeftDoubleRightDouble: "╦",
	lineDownDoubleLeftRight: "╥",
	lineDownLeftDoubleRightDouble: "╤",
	lineUpLeftRight: "┴",
	lineUpBoldLeftBoldRightBold: "┻",
	lineUpLeftBoldRightBold: "┷",
	lineUpBoldLeftRight: "┸",
	lineUpBoldLeftBoldRight: "┹",
	lineUpBoldLeftRightBold: "┺",
	lineUpLeftRightBold: "┶",
	lineUpLeftBoldRight: "┵",
	lineUpDoubleLeftDoubleRightDouble: "╩",
	lineUpDoubleLeftRight: "╨",
	lineUpLeftDoubleRightDouble: "╧",
	lineUpDownLeftRight: "┼",
	lineUpBoldDownBoldLeftBoldRightBold: "╋",
	lineUpDownBoldLeftBoldRightBold: "╈",
	lineUpBoldDownLeftBoldRightBold: "╇",
	lineUpBoldDownBoldLeftRightBold: "╊",
	lineUpBoldDownBoldLeftBoldRight: "╉",
	lineUpBoldDownLeftRight: "╀",
	lineUpDownBoldLeftRight: "╁",
	lineUpDownLeftBoldRight: "┽",
	lineUpDownLeftRightBold: "┾",
	lineUpBoldDownBoldLeftRight: "╂",
	lineUpDownLeftBoldRightBold: "┿",
	lineUpBoldDownLeftBoldRight: "╃",
	lineUpBoldDownLeftRightBold: "╄",
	lineUpDownBoldLeftBoldRight: "╅",
	lineUpDownBoldLeftRightBold: "╆",
	lineUpDoubleDownDoubleLeftDoubleRightDouble: "╬",
	lineUpDoubleDownDoubleLeftRight: "╫",
	lineUpDownLeftDoubleRightDouble: "╪",
	lineCross: "╳",
	lineBackslash: "╲",
	lineSlash: "╱"
};
const specialMainSymbols = {
	tick: "✔",
	info: "ℹ",
	warning: "⚠",
	cross: "✘",
	squareSmall: "◻",
	squareSmallFilled: "◼",
	circle: "◯",
	circleFilled: "◉",
	circleDotted: "◌",
	circleDouble: "◎",
	circleCircle: "ⓞ",
	circleCross: "ⓧ",
	circlePipe: "Ⓘ",
	radioOn: "◉",
	radioOff: "◯",
	checkboxOn: "☒",
	checkboxOff: "☐",
	checkboxCircleOn: "ⓧ",
	checkboxCircleOff: "Ⓘ",
	pointer: "❯",
	triangleUpOutline: "△",
	triangleLeft: "◀",
	triangleRight: "▶",
	lozenge: "◆",
	lozengeOutline: "◇",
	hamburger: "☰",
	smiley: "㋡",
	mustache: "෴",
	star: "★",
	play: "▶",
	nodejs: "⬢",
	oneSeventh: "⅐",
	oneNinth: "⅑",
	oneTenth: "⅒"
};
const specialFallbackSymbols = {
	tick: "√",
	info: "i",
	warning: "‼",
	cross: "×",
	squareSmall: "□",
	squareSmallFilled: "■",
	circle: "( )",
	circleFilled: "(*)",
	circleDotted: "( )",
	circleDouble: "( )",
	circleCircle: "(○)",
	circleCross: "(×)",
	circlePipe: "(│)",
	radioOn: "(*)",
	radioOff: "( )",
	checkboxOn: "[×]",
	checkboxOff: "[ ]",
	checkboxCircleOn: "(×)",
	checkboxCircleOff: "( )",
	pointer: ">",
	triangleUpOutline: "∆",
	triangleLeft: "◄",
	triangleRight: "►",
	lozenge: "♦",
	lozengeOutline: "◊",
	hamburger: "≡",
	smiley: "☺",
	mustache: "┌─┐",
	star: "✶",
	play: "►",
	nodejs: "♦",
	oneSeventh: "1/7",
	oneNinth: "1/9",
	oneTenth: "1/10"
};
const mainSymbols = {
	...common,
	...specialMainSymbols
};
const fallbackSymbols = {
	...common,
	...specialFallbackSymbols
};
const shouldUseMain = isUnicodeSupported();
const figures = shouldUseMain ? mainSymbols : fallbackSymbols;
const replacements = Object.entries(specialMainSymbols);

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/yoctocolors@2.1.2/node_modules/yoctocolors/base.js
const hasColors = tty?.WriteStream?.prototype?.hasColors?.() ?? false;
const format = (open, close) => {
	if (!hasColors) return (input) => input;
	const openCode = `\u001B[${open}m`;
	const closeCode = `\u001B[${close}m`;
	return (input) => {
		const string = input + "";
		let index = string.indexOf(closeCode);
		if (index === -1) return openCode + string + closeCode;
		let result = openCode;
		let lastIndex = 0;
		const replaceCode = (close === 22 ? closeCode : "") + openCode;
		while (index !== -1) {
			result += string.slice(lastIndex, index) + replaceCode;
			lastIndex = index + closeCode.length;
			index = string.indexOf(closeCode, lastIndex);
		}
		result += string.slice(lastIndex) + closeCode;
		return result;
	};
};
const reset = format(0, 0);
const bold = format(1, 22);
const dim = format(2, 22);
const italic = format(3, 23);
const underline = format(4, 24);
const overline = format(53, 55);
const inverse = format(7, 27);
const hidden = format(8, 28);
const strikethrough = format(9, 29);
const black = format(30, 39);
const red = format(31, 39);
const green = format(32, 39);
const yellow = format(33, 39);
const blue = format(34, 39);
const magenta = format(35, 39);
const cyan = format(36, 39);
const white = format(37, 39);
const gray = format(90, 39);
const bgBlack = format(40, 49);
const bgRed = format(41, 49);
const bgGreen = format(42, 49);
const bgYellow = format(43, 49);
const bgBlue = format(44, 49);
const bgMagenta = format(45, 49);
const bgCyan = format(46, 49);
const bgWhite = format(47, 49);
const bgGray = format(100, 49);
const redBright = format(91, 39);
const greenBright = format(92, 39);
const yellowBright = format(93, 39);
const blueBright = format(94, 39);
const magentaBright = format(95, 39);
const cyanBright = format(96, 39);
const whiteBright = format(97, 39);
const bgRedBright = format(101, 49);
const bgGreenBright = format(102, 49);
const bgYellowBright = format(103, 49);
const bgBlueBright = format(104, 49);
const bgMagentaBright = format(105, 49);
const bgCyanBright = format(106, 49);
const bgWhiteBright = format(107, 49);

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/verbose/default.js
const defaultVerboseFunction = ({ type, message, timestamp, piped, commandId, result: { failed = false } = {}, options: { reject = true } }) => {
	const timestampString = serializeTimestamp(timestamp);
	const icon = ICONS[type]({
		failed,
		reject,
		piped
	});
	const color = COLORS[type]({ reject });
	return `${gray(`[${timestampString}]`)} ${gray(`[${commandId}]`)} ${color(icon)} ${color(message)}`;
};
const serializeTimestamp = (timestamp) => `${padField(timestamp.getHours(), 2)}:${padField(timestamp.getMinutes(), 2)}:${padField(timestamp.getSeconds(), 2)}.${padField(timestamp.getMilliseconds(), 3)}`;
const padField = (field, padding) => String(field).padStart(padding, "0");
const getFinalIcon = ({ failed, reject }) => {
	if (!failed) return figures.tick;
	return reject ? figures.cross : figures.warning;
};
const ICONS = {
	command: ({ piped }) => piped ? "|" : "$",
	output: () => " ",
	ipc: () => "*",
	error: getFinalIcon,
	duration: getFinalIcon
};
const identity$1 = (string) => string;
const COLORS = {
	command: () => bold,
	output: () => identity$1,
	ipc: () => identity$1,
	error: ({ reject }) => reject ? redBright : yellowBright,
	duration: () => gray
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/verbose/custom.js
const applyVerboseOnLines = (printedLines, verboseInfo, fdNumber) => {
	const verboseFunction = getVerboseFunction(verboseInfo, fdNumber);
	return printedLines.map(({ verboseLine, verboseObject }) => applyVerboseFunction(verboseLine, verboseObject, verboseFunction)).filter((printedLine) => printedLine !== void 0).map((printedLine) => appendNewline(printedLine)).join("");
};
const applyVerboseFunction = (verboseLine, verboseObject, verboseFunction) => {
	if (verboseFunction === void 0) return verboseLine;
	const printedLine = verboseFunction(verboseLine, verboseObject);
	if (typeof printedLine === "string") return printedLine;
};
const appendNewline = (printedLine) => printedLine.endsWith("\n") ? printedLine : `${printedLine}\n`;

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/verbose/log.js
const verboseLog = ({ type, verboseMessage, fdNumber, verboseInfo, result }) => {
	const finalLines = applyVerboseOnLines(getPrintedLines(verboseMessage, getVerboseObject({
		type,
		result,
		verboseInfo
	})), verboseInfo, fdNumber);
	if (finalLines !== "") console.warn(finalLines.slice(0, -1));
};
const getVerboseObject = ({ type, result, verboseInfo }) => {
	const { escapedCommand, commandId, rawOptions } = verboseInfo;
	const { piped = false, ...options } = rawOptions;
	return {
		type,
		escapedCommand,
		commandId: `${commandId}`,
		timestamp: /* @__PURE__ */ new Date(),
		piped,
		result,
		options
	};
};
const getPrintedLines = (verboseMessage, verboseObject) => verboseMessage.split("\n").map((message) => getPrintedLine({
	...verboseObject,
	message
}));
const getPrintedLine = (verboseObject) => {
	return {
		verboseLine: defaultVerboseFunction(verboseObject),
		verboseObject
	};
};
const serializeVerboseMessage = (message) => {
	return escapeLines(typeof message === "string" ? message : inspect(message)).replaceAll("	", () => " ".repeat(TAB_SIZE));
};
const TAB_SIZE = 2;

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/verbose/start.js
const logCommand = (escapedCommand, verboseInfo) => {
	if (!isVerbose(verboseInfo)) return;
	verboseLog({
		type: "command",
		verboseMessage: escapedCommand,
		verboseInfo
	});
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/verbose/info.js
const getVerboseInfo = (verbose, escapedCommand, rawOptions) => {
	validateVerbose(verbose);
	return {
		verbose,
		escapedCommand,
		commandId: getCommandId(verbose),
		rawOptions
	};
};
const getCommandId = (verbose) => isVerbose({ verbose }) ? COMMAND_ID++ : void 0;
let COMMAND_ID = 0n;
const validateVerbose = (verbose) => {
	for (const fdVerbose of verbose) {
		if (fdVerbose === false) throw new TypeError("The \"verbose: false\" option was renamed to \"verbose: 'none'\".");
		if (fdVerbose === true) throw new TypeError("The \"verbose: true\" option was renamed to \"verbose: 'short'\".");
		if (!VERBOSE_VALUES.includes(fdVerbose) && !isVerboseFunction(fdVerbose)) {
			const allowedValues = VERBOSE_VALUES.map((allowedValue) => `'${allowedValue}'`).join(", ");
			throw new TypeError(`The "verbose" option must not be ${fdVerbose}. Allowed values are: ${allowedValues} or a function.`);
		}
	}
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/return/duration.js
const getStartTime = () => hrtime.bigint();
const getDurationMs = (startTime) => Number(hrtime.bigint() - startTime) / 1e6;

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/arguments/command.js
const handleCommand = (filePath, rawArguments, rawOptions) => {
	const startTime = getStartTime();
	const { command, escapedCommand } = joinCommand(filePath, rawArguments);
	const verboseInfo = getVerboseInfo(normalizeFdSpecificOption(rawOptions, "verbose"), escapedCommand, { ...rawOptions });
	logCommand(escapedCommand, verboseInfo);
	return {
		command,
		escapedCommand,
		startTime,
		verboseInfo
	};
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/path-key@4.0.0/node_modules/path-key/index.js
function pathKey(options = {}) {
	const { env = process.env, platform = process.platform } = options;
	if (platform !== "win32") return "PATH";
	return Object.keys(env).reverse().find((key) => key.toUpperCase() === "PATH") || "Path";
}

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/unicorn-magic@0.3.0/node_modules/unicorn-magic/node.js
const execFileOriginal = promisify(execFile);
function toPath(urlOrPath) {
	return urlOrPath instanceof URL ? fileURLToPath(urlOrPath) : urlOrPath;
}
function traversePathUp(startPath) {
	return { *[Symbol.iterator]() {
		let currentPath = path.resolve(toPath(startPath));
		let previousPath;
		while (previousPath !== currentPath) {
			yield currentPath;
			previousPath = currentPath;
			currentPath = path.resolve(currentPath, "..");
		}
	} };
}

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/npm-run-path@6.0.0/node_modules/npm-run-path/index.js
const npmRunPath = ({ cwd = process$1.cwd(), path: pathOption = process$1.env[pathKey()], preferLocal = true, execPath = process$1.execPath, addExecPath = true } = {}) => {
	const cwdPath = path.resolve(toPath(cwd));
	const result = [];
	const pathParts = pathOption.split(path.delimiter);
	if (preferLocal) applyPreferLocal(result, pathParts, cwdPath);
	if (addExecPath) applyExecPath(result, pathParts, execPath, cwdPath);
	return pathOption === "" || pathOption === path.delimiter ? `${result.join(path.delimiter)}${pathOption}` : [...result, pathOption].join(path.delimiter);
};
const applyPreferLocal = (result, pathParts, cwdPath) => {
	for (const directory of traversePathUp(cwdPath)) {
		const pathPart = path.join(directory, "node_modules/.bin");
		if (!pathParts.includes(pathPart)) result.push(pathPart);
	}
};
const applyExecPath = (result, pathParts, execPath, cwdPath) => {
	const pathPart = path.resolve(cwdPath, toPath(execPath), "..");
	if (!pathParts.includes(pathPart)) result.push(pathPart);
};
const npmRunPathEnv = ({ env = process$1.env, ...options } = {}) => {
	env = { ...env };
	const pathName = pathKey({ env });
	options.path = env[pathName];
	env[pathName] = npmRunPath(options);
	return env;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/return/final-error.js
const getFinalError = (originalError, message, isSync) => {
	return new (isSync ? ExecaSyncError : ExecaError)(message, originalError instanceof DiscardedError ? {} : { cause: originalError });
};
var DiscardedError = class extends Error {};
const setErrorName = (ErrorClass, value) => {
	Object.defineProperties(ErrorClass.prototype, {
		name: {
			value,
			writable: true,
			enumerable: false,
			configurable: true
		},
		[execaErrorSymbol]: {
			value: true,
			writable: false,
			enumerable: false,
			configurable: false
		}
	});
};
const isExecaError = (error) => isErrorInstance(error) && execaErrorSymbol in error;
const execaErrorSymbol = Symbol("isExecaError");
const isErrorInstance = (value) => Object.prototype.toString.call(value) === "[object Error]";
var ExecaError = class extends Error {};
setErrorName(ExecaError, ExecaError.name);
var ExecaSyncError = class extends Error {};
setErrorName(ExecaSyncError, ExecaSyncError.name);

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/human-signals@8.0.1/node_modules/human-signals/build/src/realtime.js
const getRealtimeSignals = () => {
	const length = 64 - SIGRTMIN + 1;
	return Array.from({ length }, getRealtimeSignal);
};
const getRealtimeSignal = (value, index) => ({
	name: `SIGRT${index + 1}`,
	number: SIGRTMIN + index,
	action: "terminate",
	description: "Application-specific signal (realtime)",
	standard: "posix"
});
const SIGRTMIN = 34;
const SIGRTMAX = 64;

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/human-signals@8.0.1/node_modules/human-signals/build/src/core.js
const SIGNALS = [
	{
		name: "SIGHUP",
		number: 1,
		action: "terminate",
		description: "Terminal closed",
		standard: "posix"
	},
	{
		name: "SIGINT",
		number: 2,
		action: "terminate",
		description: "User interruption with CTRL-C",
		standard: "ansi"
	},
	{
		name: "SIGQUIT",
		number: 3,
		action: "core",
		description: "User interruption with CTRL-\\",
		standard: "posix"
	},
	{
		name: "SIGILL",
		number: 4,
		action: "core",
		description: "Invalid machine instruction",
		standard: "ansi"
	},
	{
		name: "SIGTRAP",
		number: 5,
		action: "core",
		description: "Debugger breakpoint",
		standard: "posix"
	},
	{
		name: "SIGABRT",
		number: 6,
		action: "core",
		description: "Aborted",
		standard: "ansi"
	},
	{
		name: "SIGIOT",
		number: 6,
		action: "core",
		description: "Aborted",
		standard: "bsd"
	},
	{
		name: "SIGBUS",
		number: 7,
		action: "core",
		description: "Bus error due to misaligned, non-existing address or paging error",
		standard: "bsd"
	},
	{
		name: "SIGEMT",
		number: 7,
		action: "terminate",
		description: "Command should be emulated but is not implemented",
		standard: "other"
	},
	{
		name: "SIGFPE",
		number: 8,
		action: "core",
		description: "Floating point arithmetic error",
		standard: "ansi"
	},
	{
		name: "SIGKILL",
		number: 9,
		action: "terminate",
		description: "Forced termination",
		standard: "posix",
		forced: true
	},
	{
		name: "SIGUSR1",
		number: 10,
		action: "terminate",
		description: "Application-specific signal",
		standard: "posix"
	},
	{
		name: "SIGSEGV",
		number: 11,
		action: "core",
		description: "Segmentation fault",
		standard: "ansi"
	},
	{
		name: "SIGUSR2",
		number: 12,
		action: "terminate",
		description: "Application-specific signal",
		standard: "posix"
	},
	{
		name: "SIGPIPE",
		number: 13,
		action: "terminate",
		description: "Broken pipe or socket",
		standard: "posix"
	},
	{
		name: "SIGALRM",
		number: 14,
		action: "terminate",
		description: "Timeout or timer",
		standard: "posix"
	},
	{
		name: "SIGTERM",
		number: 15,
		action: "terminate",
		description: "Termination",
		standard: "ansi"
	},
	{
		name: "SIGSTKFLT",
		number: 16,
		action: "terminate",
		description: "Stack is empty or overflowed",
		standard: "other"
	},
	{
		name: "SIGCHLD",
		number: 17,
		action: "ignore",
		description: "Child process terminated, paused or unpaused",
		standard: "posix"
	},
	{
		name: "SIGCLD",
		number: 17,
		action: "ignore",
		description: "Child process terminated, paused or unpaused",
		standard: "other"
	},
	{
		name: "SIGCONT",
		number: 18,
		action: "unpause",
		description: "Unpaused",
		standard: "posix",
		forced: true
	},
	{
		name: "SIGSTOP",
		number: 19,
		action: "pause",
		description: "Paused",
		standard: "posix",
		forced: true
	},
	{
		name: "SIGTSTP",
		number: 20,
		action: "pause",
		description: "Paused using CTRL-Z or \"suspend\"",
		standard: "posix"
	},
	{
		name: "SIGTTIN",
		number: 21,
		action: "pause",
		description: "Background process cannot read terminal input",
		standard: "posix"
	},
	{
		name: "SIGBREAK",
		number: 21,
		action: "terminate",
		description: "User interruption with CTRL-BREAK",
		standard: "other"
	},
	{
		name: "SIGTTOU",
		number: 22,
		action: "pause",
		description: "Background process cannot write to terminal output",
		standard: "posix"
	},
	{
		name: "SIGURG",
		number: 23,
		action: "ignore",
		description: "Socket received out-of-band data",
		standard: "bsd"
	},
	{
		name: "SIGXCPU",
		number: 24,
		action: "core",
		description: "Process timed out",
		standard: "bsd"
	},
	{
		name: "SIGXFSZ",
		number: 25,
		action: "core",
		description: "File too big",
		standard: "bsd"
	},
	{
		name: "SIGVTALRM",
		number: 26,
		action: "terminate",
		description: "Timeout or timer",
		standard: "bsd"
	},
	{
		name: "SIGPROF",
		number: 27,
		action: "terminate",
		description: "Timeout or timer",
		standard: "bsd"
	},
	{
		name: "SIGWINCH",
		number: 28,
		action: "ignore",
		description: "Terminal window size changed",
		standard: "bsd"
	},
	{
		name: "SIGIO",
		number: 29,
		action: "terminate",
		description: "I/O is available",
		standard: "other"
	},
	{
		name: "SIGPOLL",
		number: 29,
		action: "terminate",
		description: "Watched event",
		standard: "other"
	},
	{
		name: "SIGINFO",
		number: 29,
		action: "ignore",
		description: "Request for process information",
		standard: "other"
	},
	{
		name: "SIGPWR",
		number: 30,
		action: "terminate",
		description: "Device running out of power",
		standard: "systemv"
	},
	{
		name: "SIGSYS",
		number: 31,
		action: "core",
		description: "Invalid system call",
		standard: "other"
	},
	{
		name: "SIGUNUSED",
		number: 31,
		action: "terminate",
		description: "Invalid system call",
		standard: "other"
	}
];

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/human-signals@8.0.1/node_modules/human-signals/build/src/signals.js
const getSignals = () => {
	const realtimeSignals = getRealtimeSignals();
	return [...SIGNALS, ...realtimeSignals].map(normalizeSignal$1);
};
const normalizeSignal$1 = ({ name, number: defaultNumber, description, action, forced = false, standard }) => {
	const { signals: { [name]: constantSignal } } = constants;
	const supported = constantSignal !== void 0;
	return {
		name,
		number: supported ? constantSignal : defaultNumber,
		description,
		supported,
		action,
		forced,
		standard
	};
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/human-signals@8.0.1/node_modules/human-signals/build/src/main.js
const getSignalsByName = () => {
	const signals = getSignals();
	return Object.fromEntries(signals.map(getSignalByName));
};
const getSignalByName = ({ name, number, description, supported, action, forced, standard }) => [name, {
	name,
	number,
	description,
	supported,
	action,
	forced,
	standard
}];
const signalsByName = getSignalsByName();
const getSignalsByNumber = () => {
	const signals = getSignals();
	const length = 64 + 1;
	const signalsA = Array.from({ length }, (value, number) => getSignalByNumber(number, signals));
	return Object.assign({}, ...signalsA);
};
const getSignalByNumber = (number, signals) => {
	const signal = findSignalByNumber(number, signals);
	if (signal === void 0) return {};
	const { name, description, supported, action, forced, standard } = signal;
	return { [number]: {
		name,
		number,
		description,
		supported,
		action,
		forced,
		standard
	} };
};
const findSignalByNumber = (number, signals) => {
	const signal = signals.find(({ name }) => constants.signals[name] === number);
	if (signal !== void 0) return signal;
	return signals.find((signalA) => signalA.number === number);
};
const signalsByNumber = getSignalsByNumber();

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/terminate/signal.js
const normalizeKillSignal = (killSignal) => {
	const optionName = "option `killSignal`";
	if (killSignal === 0) throw new TypeError(`Invalid ${optionName}: 0 cannot be used.`);
	return normalizeSignal(killSignal, optionName);
};
const normalizeSignalArgument = (signal) => signal === 0 ? signal : normalizeSignal(signal, "`subprocess.kill()`'s argument");
const normalizeSignal = (signalNameOrInteger, optionName) => {
	if (Number.isInteger(signalNameOrInteger)) return normalizeSignalInteger(signalNameOrInteger, optionName);
	if (typeof signalNameOrInteger === "string") return normalizeSignalName(signalNameOrInteger, optionName);
	throw new TypeError(`Invalid ${optionName} ${String(signalNameOrInteger)}: it must be a string or an integer.\n${getAvailableSignals()}`);
};
const normalizeSignalInteger = (signalInteger, optionName) => {
	if (signalsIntegerToName.has(signalInteger)) return signalsIntegerToName.get(signalInteger);
	throw new TypeError(`Invalid ${optionName} ${signalInteger}: this signal integer does not exist.\n${getAvailableSignals()}`);
};
const getSignalsIntegerToName = () => new Map(Object.entries(constants.signals).reverse().map(([signalName, signalInteger]) => [signalInteger, signalName]));
const signalsIntegerToName = getSignalsIntegerToName();
const normalizeSignalName = (signalName, optionName) => {
	if (signalName in constants.signals) return signalName;
	if (signalName.toUpperCase() in constants.signals) throw new TypeError(`Invalid ${optionName} '${signalName}': please rename it to '${signalName.toUpperCase()}'.`);
	throw new TypeError(`Invalid ${optionName} '${signalName}': this signal name does not exist.\n${getAvailableSignals()}`);
};
const getAvailableSignals = () => `Available signal names: ${getAvailableSignalNames()}.
Available signal numbers: ${getAvailableSignalIntegers()}.`;
const getAvailableSignalNames = () => Object.keys(constants.signals).sort().map((signalName) => `'${signalName}'`).join(", ");
const getAvailableSignalIntegers = () => [...new Set(Object.values(constants.signals).sort((signalInteger, signalIntegerTwo) => signalInteger - signalIntegerTwo))].join(", ");
const getSignalDescription = (signal) => signalsByName[signal].description;

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/terminate/kill.js
const normalizeForceKillAfterDelay = (forceKillAfterDelay) => {
	if (forceKillAfterDelay === false) return forceKillAfterDelay;
	if (forceKillAfterDelay === true) return DEFAULT_FORCE_KILL_TIMEOUT;
	if (!Number.isFinite(forceKillAfterDelay) || forceKillAfterDelay < 0) throw new TypeError(`Expected the \`forceKillAfterDelay\` option to be a non-negative integer, got \`${forceKillAfterDelay}\` (${typeof forceKillAfterDelay})`);
	return forceKillAfterDelay;
};
const DEFAULT_FORCE_KILL_TIMEOUT = 1e3 * 5;
const subprocessKill = ({ kill, options: { forceKillAfterDelay, killSignal }, onInternalError, context, controller }, signalOrError, errorArgument) => {
	const { signal, error } = parseKillArguments(signalOrError, errorArgument, killSignal);
	emitKillError(error, onInternalError);
	const killResult = kill(signal);
	setKillTimeout({
		kill,
		signal,
		forceKillAfterDelay,
		killSignal,
		killResult,
		context,
		controller
	});
	return killResult;
};
const parseKillArguments = (signalOrError, errorArgument, killSignal) => {
	const [signal = killSignal, error] = isErrorInstance(signalOrError) ? [void 0, signalOrError] : [signalOrError, errorArgument];
	if (typeof signal !== "string" && !Number.isInteger(signal)) throw new TypeError(`The first argument must be an error instance or a signal name string/integer: ${String(signal)}`);
	if (error !== void 0 && !isErrorInstance(error)) throw new TypeError(`The second argument is optional. If specified, it must be an error instance: ${error}`);
	return {
		signal: normalizeSignalArgument(signal),
		error
	};
};
const emitKillError = (error, onInternalError) => {
	if (error !== void 0) onInternalError.reject(error);
};
const setKillTimeout = async ({ kill, signal, forceKillAfterDelay, killSignal, killResult, context, controller }) => {
	if (signal === killSignal && killResult) killOnTimeout({
		kill,
		forceKillAfterDelay,
		context,
		controllerSignal: controller.signal
	});
};
const killOnTimeout = async ({ kill, forceKillAfterDelay, context, controllerSignal }) => {
	if (forceKillAfterDelay === false) return;
	try {
		await setTimeout(forceKillAfterDelay, void 0, { signal: controllerSignal });
		if (kill("SIGKILL")) context.isForcefullyTerminated ??= true;
	} catch {}
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/utils/abort-signal.js
const onAbortedSignal = async (mainSignal, stopSignal) => {
	if (!mainSignal.aborted) await once(mainSignal, "abort", { signal: stopSignal });
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/terminate/cancel.js
const validateCancelSignal = ({ cancelSignal }) => {
	if (cancelSignal !== void 0 && Object.prototype.toString.call(cancelSignal) !== "[object AbortSignal]") throw new Error(`The \`cancelSignal\` option must be an AbortSignal: ${String(cancelSignal)}`);
};
const throwOnCancel = ({ kill, cancelSignal, gracefulCancel, context, controller }) => cancelSignal === void 0 || gracefulCancel ? [] : [terminateOnCancel(kill, cancelSignal, context, controller)];
const terminateOnCancel = async (kill, cancelSignal, context, { signal }) => {
	await onAbortedSignal(cancelSignal, signal);
	context.terminationReason ??= "cancel";
	kill();
	throw cancelSignal.reason;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/ipc/validation.js
const validateIpcMethod = ({ methodName, isSubprocess, ipc, isConnected }) => {
	validateIpcOption(methodName, isSubprocess, ipc);
	validateConnection(methodName, isSubprocess, isConnected);
};
const validateIpcOption = (methodName, isSubprocess, ipc) => {
	if (!ipc) throw new Error(`${getMethodName(methodName, isSubprocess)} can only be used if the \`ipc\` option is \`true\`.`);
};
const validateConnection = (methodName, isSubprocess, isConnected) => {
	if (!isConnected) throw new Error(`${getMethodName(methodName, isSubprocess)} cannot be used: the ${getOtherProcessName(isSubprocess)} has already exited or disconnected.`);
};
const throwOnEarlyDisconnect = (isSubprocess) => {
	throw new Error(`${getMethodName("getOneMessage", isSubprocess)} could not complete: the ${getOtherProcessName(isSubprocess)} exited or disconnected.`);
};
const throwOnStrictDeadlockError = (isSubprocess) => {
	throw new Error(`${getMethodName("sendMessage", isSubprocess)} failed: the ${getOtherProcessName(isSubprocess)} is sending a message too, instead of listening to incoming messages.
This can be fixed by both sending a message and listening to incoming messages at the same time:

const [receivedMessage] = await Promise.all([
	${getMethodName("getOneMessage", isSubprocess)},
	${getMethodName("sendMessage", isSubprocess, "message, {strict: true}")},
]);`);
};
const getStrictResponseError = (error, isSubprocess) => new Error(`${getMethodName("sendMessage", isSubprocess)} failed when sending an acknowledgment response to the ${getOtherProcessName(isSubprocess)}.`, { cause: error });
const throwOnMissingStrict = (isSubprocess) => {
	throw new Error(`${getMethodName("sendMessage", isSubprocess)} failed: the ${getOtherProcessName(isSubprocess)} is not listening to incoming messages.`);
};
const throwOnStrictDisconnect = (isSubprocess) => {
	throw new Error(`${getMethodName("sendMessage", isSubprocess)} failed: the ${getOtherProcessName(isSubprocess)} exited without listening to incoming messages.`);
};
const getAbortDisconnectError = () => /* @__PURE__ */ new Error(`\`cancelSignal\` aborted: the ${getOtherProcessName(true)} disconnected.`);
const throwOnMissingParent = () => {
	throw new Error("`getCancelSignal()` cannot be used without setting the `cancelSignal` subprocess option.");
};
const handleEpipeError = ({ error, methodName, isSubprocess }) => {
	if (error.code === "EPIPE") throw new Error(`${getMethodName(methodName, isSubprocess)} cannot be used: the ${getOtherProcessName(isSubprocess)} is disconnecting.`, { cause: error });
};
const handleSerializationError = ({ error, methodName, isSubprocess, message }) => {
	if (isSerializationError(error)) throw new Error(`${getMethodName(methodName, isSubprocess)}'s argument type is invalid: the message cannot be serialized: ${String(message)}.`, { cause: error });
};
const isSerializationError = ({ code, message }) => SERIALIZATION_ERROR_CODES.has(code) || SERIALIZATION_ERROR_MESSAGES.some((serializationErrorMessage) => message.includes(serializationErrorMessage));
const SERIALIZATION_ERROR_CODES = new Set(["ERR_MISSING_ARGS", "ERR_INVALID_ARG_TYPE"]);
const SERIALIZATION_ERROR_MESSAGES = [
	"could not be cloned",
	"circular structure",
	"call stack size exceeded"
];
const getMethodName = (methodName, isSubprocess, parameters = "") => methodName === "cancelSignal" ? "`cancelSignal`'s `controller.abort()`" : `${getNamespaceName(isSubprocess)}${methodName}(${parameters})`;
const getNamespaceName = (isSubprocess) => isSubprocess ? "" : "subprocess.";
const getOtherProcessName = (isSubprocess) => isSubprocess ? "parent process" : "subprocess";
const disconnect = (anyProcess) => {
	if (anyProcess.connected) anyProcess.disconnect();
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/utils/deferred.js
const createDeferred = () => {
	const methods = {};
	const promise = new Promise((resolve, reject) => {
		Object.assign(methods, {
			resolve,
			reject
		});
	});
	return Object.assign(promise, methods);
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/utils/max-listeners.js
const incrementMaxListeners = (eventEmitter, maxListenersIncrement, signal) => {
	const maxListeners = eventEmitter.getMaxListeners();
	if (maxListeners === 0 || maxListeners === Infinity) return;
	eventEmitter.setMaxListeners(maxListeners + maxListenersIncrement);
	addAbortListener(signal, () => {
		eventEmitter.setMaxListeners(eventEmitter.getMaxListeners() - maxListenersIncrement);
	});
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/ipc/reference.js
const addReference = (channel, reference) => {
	if (reference) addReferenceCount(channel);
};
const addReferenceCount = (channel) => {
	channel.refCounted();
};
const removeReference = (channel, reference) => {
	if (reference) removeReferenceCount(channel);
};
const removeReferenceCount = (channel) => {
	channel.unrefCounted();
};
const undoAddedReferences = (channel, isSubprocess) => {
	if (!isSubprocess) return;
	removeReferenceCount(channel);
	removeReferenceCount(channel);
};
const redoAddedReferences = (channel, isSubprocess) => {
	if (!isSubprocess) return;
	addReferenceCount(channel);
	addReferenceCount(channel);
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/ipc/incoming.js
const onMessage = async ({ anyProcess, channel, isSubprocess, ipcEmitter }, wrappedMessage) => {
	if (handleStrictResponse(wrappedMessage) || handleAbort(wrappedMessage)) return;
	if (!INCOMING_MESSAGES.has(anyProcess)) INCOMING_MESSAGES.set(anyProcess, []);
	const incomingMessages = INCOMING_MESSAGES.get(anyProcess);
	incomingMessages.push(wrappedMessage);
	if (incomingMessages.length > 1) return;
	while (incomingMessages.length > 0) {
		await waitForOutgoingMessages(anyProcess, ipcEmitter, wrappedMessage);
		await scheduler.yield();
		const message = await handleStrictRequest({
			wrappedMessage: incomingMessages[0],
			anyProcess,
			channel,
			isSubprocess,
			ipcEmitter
		});
		incomingMessages.shift();
		ipcEmitter.emit("message", message);
		ipcEmitter.emit("message:done");
	}
};
const onDisconnect = async ({ anyProcess, channel, isSubprocess, ipcEmitter, boundOnMessage }) => {
	abortOnDisconnect();
	const incomingMessages = INCOMING_MESSAGES.get(anyProcess);
	while (incomingMessages?.length > 0) await once(ipcEmitter, "message:done");
	anyProcess.removeListener("message", boundOnMessage);
	redoAddedReferences(channel, isSubprocess);
	ipcEmitter.connected = false;
	ipcEmitter.emit("disconnect");
};
const INCOMING_MESSAGES = /* @__PURE__ */ new WeakMap();

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/ipc/forward.js
const getIpcEmitter = (anyProcess, channel, isSubprocess) => {
	if (IPC_EMITTERS.has(anyProcess)) return IPC_EMITTERS.get(anyProcess);
	const ipcEmitter = new EventEmitter();
	ipcEmitter.connected = true;
	IPC_EMITTERS.set(anyProcess, ipcEmitter);
	forwardEvents({
		ipcEmitter,
		anyProcess,
		channel,
		isSubprocess
	});
	return ipcEmitter;
};
const IPC_EMITTERS = /* @__PURE__ */ new WeakMap();
const forwardEvents = ({ ipcEmitter, anyProcess, channel, isSubprocess }) => {
	const boundOnMessage = onMessage.bind(void 0, {
		anyProcess,
		channel,
		isSubprocess,
		ipcEmitter
	});
	anyProcess.on("message", boundOnMessage);
	anyProcess.once("disconnect", onDisconnect.bind(void 0, {
		anyProcess,
		channel,
		isSubprocess,
		ipcEmitter,
		boundOnMessage
	}));
	undoAddedReferences(channel, isSubprocess);
};
const isConnected = (anyProcess) => {
	const ipcEmitter = IPC_EMITTERS.get(anyProcess);
	return ipcEmitter === void 0 ? anyProcess.channel !== void 0 && anyProcess.channel !== null : ipcEmitter.connected;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/ipc/strict.js
const handleSendStrict = ({ anyProcess, channel, isSubprocess, message, strict }) => {
	if (!strict) return message;
	const hasListeners = hasMessageListeners(anyProcess, getIpcEmitter(anyProcess, channel, isSubprocess));
	return {
		id: count++,
		type: REQUEST_TYPE,
		message,
		hasListeners
	};
};
let count = 0n;
const validateStrictDeadlock = (outgoingMessages, wrappedMessage) => {
	if (wrappedMessage?.type !== REQUEST_TYPE || wrappedMessage.hasListeners) return;
	for (const { id } of outgoingMessages) if (id !== void 0) STRICT_RESPONSES[id].resolve({
		isDeadlock: true,
		hasListeners: false
	});
};
const handleStrictRequest = async ({ wrappedMessage, anyProcess, channel, isSubprocess, ipcEmitter }) => {
	if (wrappedMessage?.type !== REQUEST_TYPE || !anyProcess.connected) return wrappedMessage;
	const { id, message } = wrappedMessage;
	const response = {
		id,
		type: RESPONSE_TYPE,
		message: hasMessageListeners(anyProcess, ipcEmitter)
	};
	try {
		await sendMessage$1({
			anyProcess,
			channel,
			isSubprocess,
			ipc: true
		}, response);
	} catch (error) {
		ipcEmitter.emit("strict:error", error);
	}
	return message;
};
const handleStrictResponse = (wrappedMessage) => {
	if (wrappedMessage?.type !== RESPONSE_TYPE) return false;
	const { id, message: hasListeners } = wrappedMessage;
	STRICT_RESPONSES[id]?.resolve({
		isDeadlock: false,
		hasListeners
	});
	return true;
};
const waitForStrictResponse = async (wrappedMessage, anyProcess, isSubprocess) => {
	if (wrappedMessage?.type !== REQUEST_TYPE) return;
	const deferred = createDeferred();
	STRICT_RESPONSES[wrappedMessage.id] = deferred;
	const controller = new AbortController();
	try {
		const { isDeadlock, hasListeners } = await Promise.race([deferred, throwOnDisconnect$1(anyProcess, isSubprocess, controller)]);
		if (isDeadlock) throwOnStrictDeadlockError(isSubprocess);
		if (!hasListeners) throwOnMissingStrict(isSubprocess);
	} finally {
		controller.abort();
		delete STRICT_RESPONSES[wrappedMessage.id];
	}
};
const STRICT_RESPONSES = {};
const throwOnDisconnect$1 = async (anyProcess, isSubprocess, { signal }) => {
	incrementMaxListeners(anyProcess, 1, signal);
	await once(anyProcess, "disconnect", { signal });
	throwOnStrictDisconnect(isSubprocess);
};
const REQUEST_TYPE = "execa:ipc:request";
const RESPONSE_TYPE = "execa:ipc:response";

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/ipc/outgoing.js
const startSendMessage = (anyProcess, wrappedMessage, strict) => {
	if (!OUTGOING_MESSAGES.has(anyProcess)) OUTGOING_MESSAGES.set(anyProcess, /* @__PURE__ */ new Set());
	const outgoingMessages = OUTGOING_MESSAGES.get(anyProcess);
	const outgoingMessage = {
		onMessageSent: createDeferred(),
		id: strict ? wrappedMessage.id : void 0
	};
	outgoingMessages.add(outgoingMessage);
	return {
		outgoingMessages,
		outgoingMessage
	};
};
const endSendMessage = ({ outgoingMessages, outgoingMessage }) => {
	outgoingMessages.delete(outgoingMessage);
	outgoingMessage.onMessageSent.resolve();
};
const waitForOutgoingMessages = async (anyProcess, ipcEmitter, wrappedMessage) => {
	while (!hasMessageListeners(anyProcess, ipcEmitter) && OUTGOING_MESSAGES.get(anyProcess)?.size > 0) {
		const outgoingMessages = [...OUTGOING_MESSAGES.get(anyProcess)];
		validateStrictDeadlock(outgoingMessages, wrappedMessage);
		await Promise.all(outgoingMessages.map(({ onMessageSent }) => onMessageSent));
	}
};
const OUTGOING_MESSAGES = /* @__PURE__ */ new WeakMap();
const IPC_SUBPROCESS_OPTIONS = /* @__PURE__ */ new WeakMap();
const setIpcSubprocessOptions = (subprocess, options) => {
	IPC_SUBPROCESS_OPTIONS.set(subprocess, options);
};
const hasMessageListeners = (anyProcess, ipcEmitter) => ipcEmitter.listenerCount("message") > getMinListenerCount(anyProcess);
const getMinListenerCount = (anyProcess) => getOptions(anyProcess) !== void 0 && !getFdSpecificValue(getOptions(anyProcess).buffer, "ipc") ? 1 : 0;
const getOptions = (anyProcess) => IPC_SUBPROCESS_OPTIONS.get(anyProcess);

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/ipc/send.js
const sendMessage$1 = ({ anyProcess, channel, isSubprocess, ipc }, message, { strict = false } = {}) => {
	const methodName = "sendMessage";
	validateIpcMethod({
		methodName,
		isSubprocess,
		ipc,
		isConnected: anyProcess.connected
	});
	return sendMessageAsync({
		anyProcess,
		channel,
		methodName,
		isSubprocess,
		message,
		strict
	});
};
const sendMessageAsync = async ({ anyProcess, channel, methodName, isSubprocess, message, strict }) => {
	const wrappedMessage = handleSendStrict({
		anyProcess,
		channel,
		isSubprocess,
		message,
		strict
	});
	const outgoingMessagesState = startSendMessage(anyProcess, wrappedMessage, strict);
	try {
		await sendOneMessage({
			anyProcess,
			methodName,
			isSubprocess,
			wrappedMessage,
			message
		});
	} catch (error) {
		disconnect(anyProcess);
		throw error;
	} finally {
		endSendMessage(outgoingMessagesState);
	}
};
const sendOneMessage = async ({ anyProcess, methodName, isSubprocess, wrappedMessage, message }) => {
	const sendMethod = getSendMethod(anyProcess);
	try {
		await Promise.all([waitForStrictResponse(wrappedMessage, anyProcess, isSubprocess), sendMethod(wrappedMessage)]);
	} catch (error) {
		handleEpipeError({
			error,
			methodName,
			isSubprocess
		});
		handleSerializationError({
			error,
			methodName,
			isSubprocess,
			message
		});
		throw error;
	}
};
const getSendMethod = (anyProcess) => {
	if (PROCESS_SEND_METHODS.has(anyProcess)) return PROCESS_SEND_METHODS.get(anyProcess);
	const sendMethod = promisify(anyProcess.send.bind(anyProcess));
	PROCESS_SEND_METHODS.set(anyProcess, sendMethod);
	return sendMethod;
};
const PROCESS_SEND_METHODS = /* @__PURE__ */ new WeakMap();

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/ipc/graceful.js
const sendAbort = (subprocess, message) => {
	const methodName = "cancelSignal";
	validateConnection(methodName, false, subprocess.connected);
	return sendOneMessage({
		anyProcess: subprocess,
		methodName,
		isSubprocess: false,
		wrappedMessage: {
			type: GRACEFUL_CANCEL_TYPE,
			message
		},
		message
	});
};
const getCancelSignal$1 = async ({ anyProcess, channel, isSubprocess, ipc }) => {
	await startIpc({
		anyProcess,
		channel,
		isSubprocess,
		ipc
	});
	return cancelController.signal;
};
const startIpc = async ({ anyProcess, channel, isSubprocess, ipc }) => {
	if (isCancelListening) return;
	isCancelListening = true;
	if (!ipc) {
		throwOnMissingParent();
		return;
	}
	if (channel === null) {
		abortOnDisconnect();
		return;
	}
	getIpcEmitter(anyProcess, channel, isSubprocess);
	await scheduler.yield();
};
let isCancelListening = false;
const handleAbort = (wrappedMessage) => {
	if (wrappedMessage?.type !== GRACEFUL_CANCEL_TYPE) return false;
	cancelController.abort(wrappedMessage.message);
	return true;
};
const GRACEFUL_CANCEL_TYPE = "execa:ipc:cancel";
const abortOnDisconnect = () => {
	cancelController.abort(getAbortDisconnectError());
};
const cancelController = new AbortController();

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/terminate/graceful.js
const validateGracefulCancel = ({ gracefulCancel, cancelSignal, ipc, serialization }) => {
	if (!gracefulCancel) return;
	if (cancelSignal === void 0) throw new Error("The `cancelSignal` option must be defined when setting the `gracefulCancel` option.");
	if (!ipc) throw new Error("The `ipc` option cannot be false when setting the `gracefulCancel` option.");
	if (serialization === "json") throw new Error("The `serialization` option cannot be 'json' when setting the `gracefulCancel` option.");
};
const throwOnGracefulCancel = ({ subprocess, kill, cancelSignal, gracefulCancel, forceKillAfterDelay, context, controller }) => gracefulCancel ? [sendOnAbort({
	subprocess,
	kill,
	cancelSignal,
	forceKillAfterDelay,
	context,
	controller
})] : [];
const sendOnAbort = async ({ subprocess, kill, cancelSignal, forceKillAfterDelay, context, controller: { signal } }) => {
	await onAbortedSignal(cancelSignal, signal);
	await sendAbort(subprocess, getReason(cancelSignal));
	killOnTimeout({
		kill,
		forceKillAfterDelay,
		context,
		controllerSignal: signal
	});
	context.terminationReason ??= "gracefulCancel";
	throw cancelSignal.reason;
};
const getReason = ({ reason }) => {
	if (!(reason instanceof DOMException)) return reason;
	const error = new Error(reason.message);
	Object.defineProperty(error, "stack", {
		value: reason.stack,
		enumerable: false,
		configurable: true,
		writable: true
	});
	return error;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/terminate/timeout.js
const validateTimeout = ({ timeout }) => {
	if (timeout !== void 0 && (!Number.isFinite(timeout) || timeout < 0)) throw new TypeError(`Expected the \`timeout\` option to be a non-negative integer, got \`${timeout}\` (${typeof timeout})`);
};
const throwOnTimeout = (kill, timeout, context, controller) => timeout === 0 || timeout === void 0 ? [] : [killAfterTimeout(kill, timeout, context, controller)];
const killAfterTimeout = async (kill, timeout, context, { signal }) => {
	await setTimeout(timeout, void 0, { signal });
	context.terminationReason ??= "timeout";
	kill();
	throw new DiscardedError();
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/methods/node.js
const mapNode = ({ options }) => {
	if (options.node === false) throw new TypeError("The \"node\" option cannot be false with `execaNode()`.");
	return { options: {
		...options,
		node: true
	} };
};
const handleNodeOption = (file, commandArguments, { node: shouldHandleNode = false, nodePath = execPath, nodeOptions = execArgv.filter((nodeOption) => !nodeOption.startsWith("--inspect")), cwd, execPath: formerNodePath, ...options }) => {
	if (formerNodePath !== void 0) throw new TypeError("The \"execPath\" option has been removed. Please use the \"nodePath\" option instead.");
	const normalizedNodePath = safeNormalizeFileUrl(nodePath, "The \"nodePath\" option");
	const resolvedNodePath = path.resolve(cwd, normalizedNodePath);
	const newOptions = {
		__proto__: null,
		shell: false,
		...options,
		nodePath: resolvedNodePath,
		node: shouldHandleNode,
		cwd
	};
	if (!shouldHandleNode) return [
		file,
		commandArguments,
		newOptions
	];
	if (path.basename(file, ".exe") === "node") throw new TypeError("When the \"node\" option is true, the first argument does not need to be \"node\".");
	return [
		resolvedNodePath,
		[
			...nodeOptions,
			file,
			...commandArguments
		],
		{
			__proto__: null,
			ipc: true,
			...newOptions,
			shell: false
		}
	];
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/ipc/ipc-input.js
const validateIpcInputOption = ({ ipcInput, ipc, serialization }) => {
	if (ipcInput === void 0) return;
	if (!ipc) throw new Error("The `ipcInput` option cannot be set unless the `ipc` option is `true`.");
	validateIpcInput[serialization](ipcInput);
};
const validateAdvancedInput = (ipcInput) => {
	try {
		serialize(ipcInput);
	} catch (error) {
		throw new Error("The `ipcInput` option is not serializable with a structured clone.", { cause: error });
	}
};
const validateJsonInput = (ipcInput) => {
	try {
		JSON.stringify(ipcInput);
	} catch (error) {
		throw new Error("The `ipcInput` option is not serializable with JSON.", { cause: error });
	}
};
const validateIpcInput = {
	advanced: validateAdvancedInput,
	json: validateJsonInput
};
const sendIpcInput = async (subprocess, ipcInput, ipc) => {
	if (ipcInput === void 0) return;
	await sendMessage$1({
		anyProcess: subprocess,
		channel: subprocess.channel,
		isSubprocess: false,
		ipc
	}, ipcInput);
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/arguments/encoding-option.js
const validateEncoding = ({ encoding }) => {
	if (ENCODINGS.has(encoding)) return;
	const correctEncoding = getCorrectEncoding(encoding);
	if (correctEncoding !== void 0) throw new TypeError(`Invalid option \`encoding: ${serializeEncoding(encoding)}\`.
Please rename it to ${serializeEncoding(correctEncoding)}.`);
	const correctEncodings = [...ENCODINGS].map((correctEncoding) => serializeEncoding(correctEncoding)).join(", ");
	throw new TypeError(`Invalid option \`encoding: ${serializeEncoding(encoding)}\`.
Please rename it to one of: ${correctEncodings}.`);
};
const TEXT_ENCODINGS = new Set(["utf8", "utf16le"]);
const BINARY_ENCODINGS = new Set([
	"buffer",
	"hex",
	"base64",
	"base64url",
	"latin1",
	"ascii"
]);
const ENCODINGS = TEXT_ENCODINGS.union(BINARY_ENCODINGS);
const getCorrectEncoding = (encoding) => {
	if (encoding === null) return "buffer";
	if (typeof encoding !== "string") return;
	const lowerEncoding = encoding.toLowerCase();
	if (lowerEncoding in ENCODING_ALIASES) return ENCODING_ALIASES[lowerEncoding];
	if (ENCODINGS.has(lowerEncoding)) return lowerEncoding;
};
const ENCODING_ALIASES = {
	"utf-8": "utf8",
	"utf-16le": "utf16le",
	"ucs-2": "utf16le",
	ucs2: "utf16le",
	binary: "latin1"
};
const serializeEncoding = (encoding) => typeof encoding === "string" ? `"${encoding}"` : String(encoding);

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/which-command@0.1.0/node_modules/which-command/index.js
const isWindows$1 = process$1.platform === "win32";
const separatorPattern = isWindows$1 ? /[\/\\]/v : /\//v;
const defaultPathExt = ".COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC";
function resolveOptions(command, options) {
	if (typeof command !== "string" || command.length === 0) throw new TypeError("Expected a non-empty string.");
	const { cwd = process$1.cwd(), path: searchPath = process$1.env.PATH ?? (isWindows$1 ? process$1.env.Path : void 0) ?? "", pathExt = process$1.env.PATHEXT || defaultPathExt } = options;
	return {
		cwd,
		searchPath,
		pathExt
	};
}
function windowsExtensions(command, pathExt) {
	const extensions = pathExt.split(path.delimiter).filter(Boolean);
	const commandExtension = path.extname(command).toLowerCase();
	if (commandExtension !== "" && extensions.some((extension) => extension.toLowerCase() === commandExtension)) return ["", ...extensions];
	return extensions;
}
function* candidatePaths(command, { cwd, searchPath, pathExt }) {
	const extensions = isWindows$1 ? windowsExtensions(command, pathExt) : [""];
	if (separatorPattern.test(command)) {
		const base = path.resolve(cwd, command);
		for (const extension of extensions) yield base + extension;
		return;
	}
	const directories = [...isWindows$1 ? [cwd] : [], ...searchPath.split(path.delimiter)];
	for (const directory of directories) {
		const unquoted = isWindows$1 && directory.length > 1 && directory.startsWith("\"") && directory.endsWith("\"") ? directory.slice(1, -1) : directory;
		if (unquoted === "") continue;
		const base = path.resolve(cwd, unquoted, command);
		for (const extension of extensions) yield base + extension;
	}
}
function isExecutableSync(filePath) {
	let stats;
	try {
		stats = fs.statSync(filePath);
	} catch (error) {
		return isWindows$1 && error.code === "EACCES";
	}
	if (!stats.isFile()) return false;
	if (isWindows$1) return true;
	try {
		fs.accessSync(filePath, fs.constants.X_OK);
		return true;
	} catch {
		return false;
	}
}
function whichCommandSync(command, options = {}) {
	const resolved = resolveOptions(command, options);
	for (const candidate of candidatePaths(command, resolved)) if (isExecutableSync(candidate)) return candidate;
}

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/arguments/command-file.js
const parseCommandFile = (file, commandArguments, options) => {
	const parsed = {
		file,
		commandArguments: [...commandArguments],
		options
	};
	if (options.shell || process$1.platform !== "win32") return parsed;
	return escapeWindowsCommand(parsed);
};
const directlyExecutableRegExp = /\.(?:com|exe)$/i;
const batchFileRegExp = /\.(?:bat|cmd)$/i;
const escapeWindowsCommand = (parsed) => {
	const resolvedFile = resolveWithShebang(parsed);
	if (resolvedFile !== void 0 && directlyExecutableRegExp.test(resolvedFile)) return parsed;
	for (const value of [parsed.file, ...parsed.commandArguments]) assertNoLineBreak(value);
	const isDoubleEscape = resolvedFile !== void 0 && batchFileRegExp.test(resolvedFile);
	const commandLine = `"${[escapeMetaChars(path.normalize(parsed.file)), ...parsed.commandArguments.map((argument) => escapeArgument(argument, isDoubleEscape))].join(" ")}"`;
	parsed.options.windowsVerbatimArguments = true;
	return {
		file: process$1.env.comspec || "cmd.exe",
		commandArguments: [
			"/d",
			"/s",
			"/c",
			commandLine
		],
		options: parsed.options
	};
};
const resolveWithShebang = (parsed) => {
	const resolvedFile = resolvePath(parsed);
	const interpreter = resolvedFile !== void 0 && readShebang(resolvedFile);
	if (!interpreter) return resolvedFile;
	parsed.commandArguments.unshift(resolvedFile);
	parsed.file = interpreter;
	return resolvePath(parsed);
};
const resolvePath = (parsed) => {
	const environment = parsed.options.env || process$1.env;
	return whichCommandSync(parsed.file, {
		cwd: parsed.options.cwd,
		path: environment[pathKey({ env: environment })]
	});
};
const SHEBANG_BYTE_LENGTH = 150;
const readShebang = (file) => {
	const buffer = Buffer.alloc(SHEBANG_BYTE_LENGTH);
	try {
		const fileDescriptor = openSync(file, "r");
		try {
			readSync(fileDescriptor, buffer, 0, SHEBANG_BYTE_LENGTH, 0);
		} finally {
			closeSync(fileDescriptor);
		}
	} catch {
		return;
	}
	return parseShebang(buffer.toString());
};
const shebangRegExp = /^#!(?<line>.*)/;
const parseShebang = (contents) => {
	const shebangLine = contents.match(shebangRegExp)?.groups.line.trim();
	if (!shebangLine) return;
	const [interpreterPath, argument] = shebangLine.split(" ");
	const interpreter = interpreterPath.split("/").at(-1);
	if (interpreter === "env") return argument;
	return argument ? `${interpreter} ${argument}` : interpreter;
};
const lineBreakRegExp = /[\n\r]/;
const assertNoLineBreak = (value) => {
	if (lineBreakRegExp.test(value)) throw new TypeError(`The command and its arguments cannot contain a line break on Windows without a shell.\nThis would allow a command injection with \`cmd.exe\`.\nInvalid value: ${JSON.stringify(`${value}`)}`);
};
const metaCharsRegExp = /[()\][%!^"`<>&|;, *?]/g;
const escapeMetaChars = (value) => value.replaceAll(metaCharsRegExp, "^$&");
const backslashRunRegExp = /\\+/g;
const escapeArgument = (rawArgument, doubleEscape) => {
	const escapedArgument = escapeMetaChars(`"${`${rawArgument}`.replaceAll(backslashRunRegExp, (backslashes, offset, string) => {
		const nextCharacter = string[offset + backslashes.length];
		return nextCharacter === "\"" || nextCharacter === void 0 ? backslashes.repeat(2) : backslashes;
	}).replaceAll("\"", "\\\"")}"`);
	return doubleEscape ? escapeMetaChars(escapedArgument) : escapedArgument;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/arguments/cwd.js
const normalizeCwd = (cwd = getDefaultCwd()) => {
	const cwdString = safeNormalizeFileUrl(cwd, "The \"cwd\" option");
	return path.resolve(cwdString);
};
const getDefaultCwd = () => {
	try {
		return process$1.cwd();
	} catch (error) {
		error.message = `The current directory does not exist.\n${error.message}`;
		throw error;
	}
};
const fixCwdError = (originalMessage, cwd) => {
	if (cwd === getDefaultCwd()) return originalMessage;
	let cwdStat;
	try {
		cwdStat = statSync(cwd);
	} catch (error) {
		return `The "cwd" option is invalid: ${cwd}.\n${error.message}\n${originalMessage}`;
	}
	if (!cwdStat.isDirectory()) return `The "cwd" option is not a directory: ${cwd}.\n${originalMessage}`;
	return originalMessage;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/arguments/options.js
const normalizeOptions = (filePath, rawArguments, rawOptions) => {
	const sanitizedOptions = {
		__proto__: null,
		...rawOptions
	};
	sanitizedOptions.cwd = normalizeCwd(sanitizedOptions.cwd);
	const [processedFile, processedArguments, processedOptions] = handleNodeOption(filePath, rawArguments, sanitizedOptions);
	const { file, commandArguments, options: initialOptions } = parseCommandFile(processedFile, processedArguments, processedOptions);
	const options = addDefaultOptions(normalizeFdSpecificOptions(initialOptions));
	validateTimeout(options);
	validateEncoding(options);
	validateIpcInputOption(options);
	validateCancelSignal(options);
	validateGracefulCancel(options);
	options.shell = normalizeFileUrl(options.shell);
	options.env = getEnv(options);
	options.killSignal = normalizeKillSignal(options.killSignal);
	options.forceKillAfterDelay = normalizeForceKillAfterDelay(options.forceKillAfterDelay);
	options.lines = options.lines.map((lines, fdNumber) => lines && !BINARY_ENCODINGS.has(options.encoding) && options.buffer[fdNumber]);
	if (process$1.platform === "win32" && path.basename(file, ".exe") === "cmd") commandArguments.unshift("/q");
	return {
		file,
		commandArguments,
		options
	};
};
const addDefaultOptions = ({ extendEnv = true, preferLocal = false, cwd, localDir: localDirectory = cwd, encoding = "utf8", reject = true, cleanup = true, killDescendants = false, all = false, windowsHide = true, killSignal = "SIGTERM", forceKillAfterDelay = true, gracefulCancel = false, ipcInput, ipc = ipcInput !== void 0 || gracefulCancel, serialization = "advanced", ...options }) => ({
	__proto__: null,
	...options,
	extendEnv,
	preferLocal,
	cwd,
	localDirectory,
	encoding,
	reject,
	cleanup,
	killDescendants,
	all,
	windowsHide,
	killSignal,
	forceKillAfterDelay,
	gracefulCancel,
	ipcInput,
	ipc,
	serialization
});
const getEnv = ({ env: envOption, extendEnv, preferLocal, node, localDirectory, nodePath }) => {
	const env = extendEnv ? {
		...process$1.env,
		...envOption
	} : envOption;
	if (preferLocal || node) return npmRunPathEnv({
		env,
		cwd: localDirectory,
		execPath: nodePath,
		preferLocal,
		addExecPath: node
	});
	return env;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/arguments/shell.js
const concatenateShell = (file, commandArguments, options) => options.shell && commandArguments.length > 0 ? [
	[file, ...commandArguments].join(" "),
	[],
	options
] : [
	file,
	commandArguments,
	options
];

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/strip-final-newline@4.0.0/node_modules/strip-final-newline/index.js
function stripFinalNewline(input) {
	if (typeof input === "string") return stripFinalNewlineString(input);
	if (!(ArrayBuffer.isView(input) && input.BYTES_PER_ELEMENT === 1)) throw new Error("Input must be a string or a Uint8Array");
	return stripFinalNewlineBinary(input);
}
const stripFinalNewlineString = (input) => input.at(-1) === LF ? input.slice(0, input.at(-2) === CR ? -2 : -1) : input;
const stripFinalNewlineBinary = (input) => input.at(-1) === LF_BINARY ? input.subarray(0, input.at(-2) === CR_BINARY ? -2 : -1) : input;
const LF = "\n";
const LF_BINARY = LF.codePointAt(0);
const CR = "\r";
const CR_BINARY = CR.codePointAt(0);

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/is-stream@4.0.1/node_modules/is-stream/index.js
function isStream(stream, { checkOpen = true } = {}) {
	return stream !== null && typeof stream === "object" && (stream.writable || stream.readable || !checkOpen || stream.writable === void 0 && stream.readable === void 0) && typeof stream.pipe === "function";
}
function isWritableStream$1(stream, { checkOpen = true } = {}) {
	return isStream(stream, { checkOpen }) && (stream.writable || !checkOpen) && typeof stream.write === "function" && typeof stream.end === "function" && typeof stream.writable === "boolean" && typeof stream.writableObjectMode === "boolean" && typeof stream.destroy === "function" && typeof stream.destroyed === "boolean";
}
function isReadableStream$1(stream, { checkOpen = true } = {}) {
	return isStream(stream, { checkOpen }) && (stream.readable || !checkOpen) && typeof stream.read === "function" && typeof stream.readable === "boolean" && typeof stream.readableObjectMode === "boolean" && typeof stream.destroy === "function" && typeof stream.destroyed === "boolean";
}
function isDuplexStream(stream, options) {
	return isWritableStream$1(stream, options) && isReadableStream$1(stream, options);
}

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/@sec-ant+readable-stream@0.4.1/node_modules/@sec-ant/readable-stream/dist/ponyfill/asyncIterator.js
const a = Object.getPrototypeOf(Object.getPrototypeOf(
	/* istanbul ignore next */
	async function* () {}
).prototype);
var c = class {
	#t;
	#n;
	#r = !1;
	#e = void 0;
	constructor(e, t) {
		this.#t = e, this.#n = t;
	}
	next() {
		const e = () => this.#s();
		return this.#e = this.#e ? this.#e.then(e, e) : e(), this.#e;
	}
	return(e) {
		const t = () => this.#i(e);
		return this.#e ? this.#e.then(t, t) : t();
	}
	async #s() {
		if (this.#r) return {
			done: !0,
			value: void 0
		};
		let e;
		try {
			e = await this.#t.read();
		} catch (t) {
			throw this.#e = void 0, this.#r = !0, this.#t.releaseLock(), t;
		}
		return e.done && (this.#e = void 0, this.#r = !0, this.#t.releaseLock()), e;
	}
	async #i(e) {
		if (this.#r) return {
			done: !0,
			value: e
		};
		if (this.#r = !0, !this.#n) {
			const t = this.#t.cancel(e);
			return this.#t.releaseLock(), await t, {
				done: !0,
				value: e
			};
		}
		return this.#t.releaseLock(), {
			done: !0,
			value: e
		};
	}
};
const n = Symbol();
function i() {
	return this[n].next();
}
Object.defineProperty(i, "name", { value: "next" });
function o(r) {
	return this[n].return(r);
}
Object.defineProperty(o, "name", { value: "return" });
const u = Object.create(a, {
	next: {
		enumerable: !0,
		configurable: !0,
		writable: !0,
		value: i
	},
	return: {
		enumerable: !0,
		configurable: !0,
		writable: !0,
		value: o
	}
});
function h({ preventCancel: r = !1 } = {}) {
	const t = new c(this.getReader(), r), s = Object.create(u);
	return s[n] = t, s;
}

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/get-stream@9.0.1/node_modules/get-stream/source/stream.js
const getAsyncIterable = (stream) => {
	if (isReadableStream$1(stream, { checkOpen: false }) && nodeImports.on !== void 0) return getStreamIterable(stream);
	if (typeof stream?.[Symbol.asyncIterator] === "function") return stream;
	if (toString.call(stream) === "[object ReadableStream]") return h.call(stream);
	throw new TypeError("The first argument must be a Readable, a ReadableStream, or an async iterable.");
};
const { toString } = Object.prototype;
const getStreamIterable = async function* (stream) {
	const controller = new AbortController();
	const state = {};
	handleStreamEnd(stream, controller, state);
	try {
		for await (const [chunk] of nodeImports.on(stream, "data", { signal: controller.signal })) yield chunk;
	} catch (error) {
		if (state.error !== void 0) throw state.error;
		else if (!controller.signal.aborted) throw error;
	} finally {
		stream.destroy();
	}
};
const handleStreamEnd = async (stream, controller, state) => {
	try {
		await nodeImports.finished(stream, {
			cleanup: true,
			readable: true,
			writable: false,
			error: false
		});
	} catch (error) {
		state.error = error;
	} finally {
		controller.abort();
	}
};
const nodeImports = {};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/get-stream@9.0.1/node_modules/get-stream/source/contents.js
const getStreamContents$1 = async (stream, { init, convertChunk, getSize, truncateChunk, addChunk, getFinalChunk, finalize }, { maxBuffer = Number.POSITIVE_INFINITY } = {}) => {
	const asyncIterable = getAsyncIterable(stream);
	const state = init();
	state.length = 0;
	try {
		for await (const chunk of asyncIterable) appendChunk({
			convertedChunk: convertChunk[getChunkType(chunk)](chunk, state),
			state,
			getSize,
			truncateChunk,
			addChunk,
			maxBuffer
		});
		appendFinalChunk({
			state,
			convertChunk,
			getSize,
			truncateChunk,
			addChunk,
			getFinalChunk,
			maxBuffer
		});
		return finalize(state);
	} catch (error) {
		const normalizedError = typeof error === "object" && error !== null ? error : new Error(error);
		normalizedError.bufferedData = finalize(state);
		throw normalizedError;
	}
};
const appendFinalChunk = ({ state, getSize, truncateChunk, addChunk, getFinalChunk, maxBuffer }) => {
	const convertedChunk = getFinalChunk(state);
	if (convertedChunk !== void 0) appendChunk({
		convertedChunk,
		state,
		getSize,
		truncateChunk,
		addChunk,
		maxBuffer
	});
};
const appendChunk = ({ convertedChunk, state, getSize, truncateChunk, addChunk, maxBuffer }) => {
	const chunkSize = getSize(convertedChunk);
	const newLength = state.length + chunkSize;
	if (newLength <= maxBuffer) {
		addNewChunk(convertedChunk, state, addChunk, newLength);
		return;
	}
	const truncatedChunk = truncateChunk(convertedChunk, maxBuffer - state.length);
	if (truncatedChunk !== void 0) addNewChunk(truncatedChunk, state, addChunk, maxBuffer);
	throw new MaxBufferError();
};
const addNewChunk = (convertedChunk, state, addChunk, newLength) => {
	state.contents = addChunk(convertedChunk, state, newLength);
	state.length = newLength;
};
const getChunkType = (chunk) => {
	const typeOfChunk = typeof chunk;
	if (typeOfChunk === "string") return "string";
	if (typeOfChunk !== "object" || chunk === null) return "others";
	if (globalThis.Buffer?.isBuffer(chunk)) return "buffer";
	const prototypeName = objectToString.call(chunk);
	if (prototypeName === "[object ArrayBuffer]") return "arrayBuffer";
	if (prototypeName === "[object DataView]") return "dataView";
	if (Number.isInteger(chunk.byteLength) && Number.isInteger(chunk.byteOffset) && objectToString.call(chunk.buffer) === "[object ArrayBuffer]") return "typedArray";
	return "others";
};
const { toString: objectToString } = Object.prototype;
var MaxBufferError = class extends Error {
	name = "MaxBufferError";
	constructor() {
		super("maxBuffer exceeded");
	}
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/get-stream@9.0.1/node_modules/get-stream/source/utils.js
const identity = (value) => value;
const noop$1 = () => void 0;
const getContentsProperty = ({ contents }) => contents;
const throwObjectStream = (chunk) => {
	throw new Error(`Streams in object mode are not supported: ${String(chunk)}`);
};
const getLengthProperty = (convertedChunk) => convertedChunk.length;

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/get-stream@9.0.1/node_modules/get-stream/source/array.js
async function getStreamAsArray(stream, options) {
	return getStreamContents$1(stream, arrayMethods, options);
}
const initArray = () => ({ contents: [] });
const increment = () => 1;
const addArrayChunk = (convertedChunk, { contents }) => {
	contents.push(convertedChunk);
	return contents;
};
const arrayMethods = {
	init: initArray,
	convertChunk: {
		string: identity,
		buffer: identity,
		arrayBuffer: identity,
		dataView: identity,
		typedArray: identity,
		others: identity
	},
	getSize: increment,
	truncateChunk: noop$1,
	addChunk: addArrayChunk,
	getFinalChunk: noop$1,
	finalize: getContentsProperty
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/get-stream@9.0.1/node_modules/get-stream/source/array-buffer.js
async function getStreamAsArrayBuffer(stream, options) {
	return getStreamContents$1(stream, arrayBufferMethods, options);
}
const initArrayBuffer = () => ({ contents: /* @__PURE__ */ new ArrayBuffer(0) });
const useTextEncoder = (chunk) => textEncoder.encode(chunk);
const textEncoder = new TextEncoder();
const useUint8Array = (chunk) => new Uint8Array(chunk);
const useUint8ArrayWithOffset = (chunk) => new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
const truncateArrayBufferChunk = (convertedChunk, chunkSize) => convertedChunk.slice(0, chunkSize);
const addArrayBufferChunk = (convertedChunk, { contents, length: previousLength }, length) => {
	const newContents = hasArrayBufferResize() ? resizeArrayBuffer(contents, length) : resizeArrayBufferSlow(contents, length);
	new Uint8Array(newContents).set(convertedChunk, previousLength);
	return newContents;
};
const resizeArrayBufferSlow = (contents, length) => {
	if (length <= contents.byteLength) return contents;
	const arrayBuffer = new ArrayBuffer(getNewContentsLength(length));
	new Uint8Array(arrayBuffer).set(new Uint8Array(contents), 0);
	return arrayBuffer;
};
const resizeArrayBuffer = (contents, length) => {
	if (length <= contents.maxByteLength) {
		contents.resize(length);
		return contents;
	}
	const arrayBuffer = new ArrayBuffer(length, { maxByteLength: getNewContentsLength(length) });
	new Uint8Array(arrayBuffer).set(new Uint8Array(contents), 0);
	return arrayBuffer;
};
const getNewContentsLength = (length) => SCALE_FACTOR ** Math.ceil(Math.log(length) / Math.log(SCALE_FACTOR));
const SCALE_FACTOR = 2;
const finalizeArrayBuffer = ({ contents, length }) => hasArrayBufferResize() ? contents : contents.slice(0, length);
const hasArrayBufferResize = () => "resize" in ArrayBuffer.prototype;
const arrayBufferMethods = {
	init: initArrayBuffer,
	convertChunk: {
		string: useTextEncoder,
		buffer: useUint8Array,
		arrayBuffer: useUint8Array,
		dataView: useUint8ArrayWithOffset,
		typedArray: useUint8ArrayWithOffset,
		others: throwObjectStream
	},
	getSize: getLengthProperty,
	truncateChunk: truncateArrayBufferChunk,
	addChunk: addArrayBufferChunk,
	getFinalChunk: noop$1,
	finalize: finalizeArrayBuffer
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/get-stream@9.0.1/node_modules/get-stream/source/string.js
async function getStreamAsString(stream, options) {
	return getStreamContents$1(stream, stringMethods, options);
}
const initString = () => ({
	contents: "",
	textDecoder: new TextDecoder()
});
const useTextDecoder = (chunk, { textDecoder }) => textDecoder.decode(chunk, { stream: true });
const addStringChunk = (convertedChunk, { contents }) => contents + convertedChunk;
const truncateStringChunk = (convertedChunk, chunkSize) => convertedChunk.slice(0, chunkSize);
const getFinalStringChunk = ({ textDecoder }) => {
	const finalChunk = textDecoder.decode();
	return finalChunk === "" ? void 0 : finalChunk;
};
const stringMethods = {
	init: initString,
	convertChunk: {
		string: identity,
		buffer: useTextDecoder,
		arrayBuffer: useTextDecoder,
		dataView: useTextDecoder,
		typedArray: useTextDecoder,
		others: throwObjectStream
	},
	getSize: getLengthProperty,
	truncateChunk: truncateStringChunk,
	addChunk: addStringChunk,
	getFinalChunk: getFinalStringChunk,
	finalize: getContentsProperty
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/io/max-buffer.js
const handleMaxBuffer = ({ error, stream, readableObjectMode, lines, encoding, fdNumber }) => {
	if (!(error instanceof MaxBufferError)) throw error;
	if (fdNumber === "all") return error;
	error.maxBufferInfo = {
		fdNumber,
		unit: getMaxBufferUnit(readableObjectMode, lines, encoding)
	};
	stream.destroy();
	throw error;
};
const getMaxBufferUnit = (readableObjectMode, lines, encoding) => {
	if (readableObjectMode) return "objects";
	if (lines) return "lines";
	if (encoding === "buffer") return "bytes";
	return "characters";
};
const checkIpcMaxBuffer = (subprocess, ipcOutput, maxBuffer) => {
	if (ipcOutput.length !== maxBuffer) return;
	const error = new MaxBufferError();
	error.maxBufferInfo = { fdNumber: "ipc" };
	throw error;
};
const getMaxBufferMessage = (error, maxBuffer) => {
	const { streamName, threshold, unit } = getMaxBufferInfo(error, maxBuffer);
	return `Command's ${streamName} was larger than ${threshold} ${unit}`;
};
const getMaxBufferInfo = (error, maxBuffer) => {
	if (error?.maxBufferInfo === void 0) return {
		streamName: "output",
		threshold: maxBuffer[1],
		unit: "bytes"
	};
	const { maxBufferInfo: { fdNumber, unit } } = error;
	delete error.maxBufferInfo;
	const threshold = getFdSpecificValue(maxBuffer, fdNumber);
	if (fdNumber === "ipc") return {
		streamName: "IPC output",
		threshold,
		unit: "messages"
	};
	return {
		streamName: getStreamName(fdNumber),
		threshold,
		unit
	};
};
const isMaxBufferSync = (resultError, output, maxBuffer) => resultError?.code === "ENOBUFS" && output !== null && output.some((result) => result !== null && result.length > getMaxBufferSync(maxBuffer));
const truncateMaxBufferSync = (result, isMaxBuffer, maxBuffer) => {
	if (!isMaxBuffer) return result;
	const maxBufferValue = getMaxBufferSync(maxBuffer);
	return result.length > maxBufferValue ? result.slice(0, maxBufferValue) : result;
};
const getMaxBufferSync = ([, stdoutMaxBuffer]) => stdoutMaxBuffer;

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/return/message.js
const createMessages = ({ stdio, all, ipcOutput, originalError, signal, signalDescription, exitCode, escapedCommand, timedOut, isCanceled, isGracefullyCanceled, isMaxBuffer, isForcefullyTerminated, forceKillAfterDelay, killSignal, maxBuffer, timeout, cwd }) => {
	const errorCode = originalError?.code;
	const prefix = getErrorPrefix({
		originalError,
		timedOut,
		timeout,
		isMaxBuffer,
		maxBuffer,
		errorCode,
		signal,
		signalDescription,
		exitCode,
		isCanceled,
		isGracefullyCanceled,
		isForcefullyTerminated,
		forceKillAfterDelay,
		killSignal
	});
	const originalMessage = getOriginalMessage(originalError, cwd);
	const shortMessage = `${prefix}: ${escapedCommand}${originalMessage === void 0 ? "" : `\n${originalMessage}`}`;
	return {
		originalMessage,
		shortMessage,
		message: [
			shortMessage,
			...all === void 0 ? [stdio[2], stdio[1]] : [all],
			...stdio.slice(3),
			ipcOutput.map((ipcMessage) => serializeIpcMessage(ipcMessage)).join("\n")
		].map((messagePart) => escapeLines(stripFinalNewline(serializeMessagePart(messagePart)))).filter(Boolean).join("\n\n")
	};
};
const getErrorPrefix = ({ originalError, timedOut, timeout, isMaxBuffer, maxBuffer, errorCode, signal, signalDescription, exitCode, isCanceled, isGracefullyCanceled, isForcefullyTerminated, forceKillAfterDelay, killSignal }) => {
	const forcefulSuffix = getForcefulSuffix(isForcefullyTerminated, forceKillAfterDelay);
	if (timedOut) return `Command timed out after ${timeout} milliseconds${forcefulSuffix}`;
	if (isGracefullyCanceled) {
		if (signal === void 0) return `Command was gracefully canceled with exit code ${exitCode}`;
		return isForcefullyTerminated ? `Command was gracefully canceled${forcefulSuffix}` : `Command was gracefully canceled with ${signal} (${signalDescription})`;
	}
	if (isCanceled) return `Command was canceled${forcefulSuffix}`;
	if (isMaxBuffer) return `${getMaxBufferMessage(originalError, maxBuffer)}${forcefulSuffix}`;
	if (errorCode !== void 0) return `Command failed with ${errorCode}${forcefulSuffix}`;
	if (isForcefullyTerminated) return `Command was killed with ${killSignal} (${getSignalDescription(killSignal)})${forcefulSuffix}`;
	if (signal !== void 0) return `Command was killed with ${signal} (${signalDescription})`;
	if (exitCode !== void 0) return `Command failed with exit code ${exitCode}`;
	return "Command failed";
};
const getForcefulSuffix = (isForcefullyTerminated, forceKillAfterDelay) => isForcefullyTerminated ? ` and was forcefully terminated after ${forceKillAfterDelay} milliseconds` : "";
const getOriginalMessage = (originalError, cwd) => {
	if (originalError instanceof DiscardedError) return;
	const escapedOriginalMessage = escapeLines(fixCwdError(isExecaError(originalError) ? originalError.originalMessage : String(originalError?.message ?? originalError), cwd));
	return escapedOriginalMessage === "" ? void 0 : escapedOriginalMessage;
};
const serializeIpcMessage = (ipcMessage) => typeof ipcMessage === "string" ? ipcMessage : inspect(ipcMessage);
const serializeMessagePart = (messagePart) => Array.isArray(messagePart) ? messagePart.map((messageItem) => stripFinalNewline(serializeMessageItem(messageItem))).filter(Boolean).join("\n") : serializeMessageItem(messagePart);
const serializeMessageItem = (messageItem) => {
	if (typeof messageItem === "string") return messageItem;
	if (isUint8Array(messageItem)) return uint8ArrayToString(messageItem);
	return "";
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/return/result.js
const makeSuccessResult = ({ command, escapedCommand, stdio, all, ipcOutput, options: { cwd }, startTime }) => omitUndefinedProperties({
	command,
	escapedCommand,
	cwd,
	durationMs: getDurationMs(startTime),
	failed: false,
	timedOut: false,
	isCanceled: false,
	isGracefullyCanceled: false,
	isTerminated: false,
	isMaxBuffer: false,
	isForcefullyTerminated: false,
	exitCode: 0,
	stdout: stdio[1],
	stderr: stdio[2],
	all,
	stdio,
	ipcOutput,
	pipedFrom: []
});
const makeEarlyError = ({ error, command, escapedCommand, fileDescriptors, options, startTime, isSync }) => makeError({
	error,
	command,
	escapedCommand,
	startTime,
	timedOut: false,
	isCanceled: false,
	isGracefullyCanceled: false,
	isMaxBuffer: false,
	isForcefullyTerminated: false,
	stdio: Array.from({ length: fileDescriptors.length }),
	ipcOutput: [],
	options,
	isSync
});
const makeError = ({ error: originalError, command, escapedCommand, startTime, timedOut, isCanceled, isGracefullyCanceled, isMaxBuffer, isForcefullyTerminated, exitCode: rawExitCode, signal: rawSignal, stdio, all, ipcOutput, options: { timeoutDuration, timeout = timeoutDuration, forceKillAfterDelay, killSignal, cwd, maxBuffer }, isSync }) => {
	const { exitCode, signal, signalDescription } = normalizeExitPayload(rawExitCode, rawSignal);
	const { originalMessage, shortMessage, message } = createMessages({
		stdio,
		all,
		ipcOutput,
		originalError,
		signal,
		signalDescription,
		exitCode,
		escapedCommand,
		timedOut,
		isCanceled,
		isGracefullyCanceled,
		isMaxBuffer,
		isForcefullyTerminated,
		forceKillAfterDelay,
		killSignal,
		maxBuffer,
		timeout,
		cwd
	});
	const error = getFinalError(originalError, message, isSync);
	Object.assign(error, getErrorProperties({
		error,
		command,
		escapedCommand,
		startTime,
		timedOut,
		isCanceled,
		isGracefullyCanceled,
		isMaxBuffer,
		isForcefullyTerminated,
		exitCode,
		signal,
		signalDescription,
		stdio,
		all,
		ipcOutput,
		cwd,
		originalMessage,
		shortMessage
	}));
	return error;
};
const getErrorProperties = ({ error, command, escapedCommand, startTime, timedOut, isCanceled, isGracefullyCanceled, isMaxBuffer, isForcefullyTerminated, exitCode, signal, signalDescription, stdio, all, ipcOutput, cwd, originalMessage, shortMessage }) => omitUndefinedProperties({
	shortMessage,
	originalMessage,
	command,
	escapedCommand,
	cwd,
	durationMs: getDurationMs(startTime),
	failed: true,
	timedOut,
	isCanceled,
	isGracefullyCanceled,
	isTerminated: signal !== void 0,
	isMaxBuffer,
	isForcefullyTerminated,
	exitCode,
	signal,
	signalDescription,
	code: error.cause?.code,
	stdout: stdio[1],
	stderr: stdio[2],
	all,
	stdio,
	ipcOutput,
	pipedFrom: []
});
const omitUndefinedProperties = (result) => Object.fromEntries(Object.entries(result).filter(([, value]) => value !== void 0));
const normalizeExitPayload = (rawExitCode, rawSignal) => {
	const exitCode = rawExitCode === null ? void 0 : rawExitCode;
	const signal = rawSignal === null ? void 0 : rawSignal;
	return {
		exitCode,
		signal,
		signalDescription: signal === void 0 ? void 0 : getSignalDescription(rawSignal)
	};
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/parse-ms@4.0.0/node_modules/parse-ms/index.js
const toZeroIfInfinity = (value) => Number.isFinite(value) ? value : 0;
function parseNumber(milliseconds) {
	return {
		days: Math.trunc(milliseconds / 864e5),
		hours: Math.trunc(milliseconds / 36e5 % 24),
		minutes: Math.trunc(milliseconds / 6e4 % 60),
		seconds: Math.trunc(milliseconds / 1e3 % 60),
		milliseconds: Math.trunc(milliseconds % 1e3),
		microseconds: Math.trunc(toZeroIfInfinity(milliseconds * 1e3) % 1e3),
		nanoseconds: Math.trunc(toZeroIfInfinity(milliseconds * 1e6) % 1e3)
	};
}
function parseBigint(milliseconds) {
	return {
		days: milliseconds / 86400000n,
		hours: milliseconds / 3600000n % 24n,
		minutes: milliseconds / 60000n % 60n,
		seconds: milliseconds / 1000n % 60n,
		milliseconds: milliseconds % 1000n,
		microseconds: 0n,
		nanoseconds: 0n
	};
}
function parseMilliseconds(milliseconds) {
	switch (typeof milliseconds) {
		case "number":
			if (Number.isFinite(milliseconds)) return parseNumber(milliseconds);
			break;
		case "bigint": return parseBigint(milliseconds);
	}
	throw new TypeError("Expected a finite number or bigint");
}

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/pretty-ms@9.3.0/node_modules/pretty-ms/index.js
const isZero = (value) => value === 0 || value === 0n;
const pluralize = (word, count) => count === 1 || count === 1n ? word : `${word}s`;
const SECOND_ROUNDING_EPSILON = 1e-7;
const ONE_DAY_IN_MILLISECONDS = 24n * 60n * 60n * 1000n;
function prettyMilliseconds(milliseconds, options) {
	const isBigInt = typeof milliseconds === "bigint";
	if (!isBigInt && !Number.isFinite(milliseconds)) throw new TypeError("Expected a finite number or bigint");
	options = { ...options };
	const sign = milliseconds < 0 ? "-" : "";
	milliseconds = milliseconds < 0 ? -milliseconds : milliseconds;
	if (options.colonNotation) {
		options.compact = false;
		options.formatSubMilliseconds = false;
		options.separateMilliseconds = false;
		options.verbose = false;
	}
	if (options.compact) {
		options.unitCount = 1;
		options.secondsDecimalDigits = 0;
		options.millisecondsDecimalDigits = 0;
	}
	let result = [];
	const floorDecimals = (value, decimalDigits) => {
		const flooredInterimValue = Math.floor(value * 10 ** decimalDigits + SECOND_ROUNDING_EPSILON);
		return (Math.round(flooredInterimValue) / 10 ** decimalDigits).toFixed(decimalDigits);
	};
	const add = (value, long, short, valueString) => {
		if ((result.length === 0 || !options.colonNotation) && isZero(value) && !(options.colonNotation && short === "m")) return;
		valueString ??= String(value);
		if (options.colonNotation) {
			const wholeDigits = valueString.includes(".") ? valueString.split(".")[0].length : valueString.length;
			const minLength = result.length > 0 ? 2 : 1;
			valueString = "0".repeat(Math.max(0, minLength - wholeDigits)) + valueString;
		} else valueString += options.verbose ? " " + pluralize(long, value) : short;
		result.push(valueString);
	};
	const parsed = parseMilliseconds(milliseconds);
	const days = BigInt(parsed.days);
	if (options.hideYearAndDays) add(BigInt(days) * 24n + BigInt(parsed.hours), "hour", "h");
	else {
		if (options.hideYear) add(days, "day", "d");
		else {
			add(days / 365n, "year", "y");
			add(days % 365n, "day", "d");
		}
		add(Number(parsed.hours), "hour", "h");
	}
	add(Number(parsed.minutes), "minute", "m");
	if (!options.hideSeconds) if (options.separateMilliseconds || options.formatSubMilliseconds || !options.colonNotation && milliseconds < 1e3 && !options.subSecondsAsDecimals) {
		const seconds = Number(parsed.seconds);
		const milliseconds = Number(parsed.milliseconds);
		const microseconds = Number(parsed.microseconds);
		const nanoseconds = Number(parsed.nanoseconds);
		add(seconds, "second", "s");
		if (options.formatSubMilliseconds) {
			add(milliseconds, "millisecond", "ms");
			add(microseconds, "microsecond", "µs");
			add(nanoseconds, "nanosecond", "ns");
		} else {
			const millisecondsAndBelow = milliseconds + microseconds / 1e3 + nanoseconds / 1e6;
			const millisecondsDecimalDigits = typeof options.millisecondsDecimalDigits === "number" ? options.millisecondsDecimalDigits : 0;
			const millisecondsString = millisecondsDecimalDigits ? millisecondsAndBelow.toFixed(millisecondsDecimalDigits) : millisecondsAndBelow >= 1 ? Math.round(millisecondsAndBelow) : Math.ceil(millisecondsAndBelow);
			add(Number.parseFloat(millisecondsString), "millisecond", "ms", millisecondsString);
		}
	} else {
		const secondsFixed = floorDecimals((isBigInt ? Number(milliseconds % ONE_DAY_IN_MILLISECONDS) : milliseconds) / 1e3 % 60, typeof options.secondsDecimalDigits === "number" ? options.secondsDecimalDigits : 1);
		const secondsString = options.keepDecimalsOnWholeSeconds ? secondsFixed : secondsFixed.replace(/\.0+$/, "");
		add(Number.parseFloat(secondsString), "second", "s", secondsString);
	}
	if (result.length === 0) return sign + "0" + (options.verbose ? " milliseconds" : "ms");
	const separator = options.colonNotation ? ":" : " ";
	if (typeof options.unitCount === "number") result = result.slice(0, Math.max(options.unitCount, 1));
	return sign + result.join(separator);
}

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/verbose/error.js
const logError = (result, verboseInfo) => {
	if (result.failed) verboseLog({
		type: "error",
		verboseMessage: result.shortMessage,
		verboseInfo,
		result
	});
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/verbose/complete.js
const logResult = (result, verboseInfo) => {
	if (!isVerbose(verboseInfo)) return;
	logError(result, verboseInfo);
	logDuration(result, verboseInfo);
};
const logDuration = (result, verboseInfo) => {
	verboseLog({
		type: "duration",
		verboseMessage: `(done in ${prettyMilliseconds(result.durationMs)})`,
		verboseInfo,
		result
	});
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/return/reject.js
const handleResult = (result, verboseInfo, { reject }) => {
	logResult(result, verboseInfo);
	if (result.failed && reject) throw result;
	return result;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/stdio/type.js
const getStdioItemType = (value, optionName) => {
	if (isAsyncGenerator(value)) return "asyncGenerator";
	if (isSyncGenerator(value)) return "generator";
	if (isUrl(value)) return "fileUrl";
	if (isFilePathObject(value)) return "filePath";
	if (isWebStream(value)) return "webStream";
	if (isStream(value, { checkOpen: false })) return "native";
	if (isUint8Array(value)) return "uint8Array";
	if (isAsyncIterableObject(value)) return "asyncIterable";
	if (isIterableObject(value)) return "iterable";
	if (isTransformStream(value)) return getTransformStreamType({ transform: value }, optionName);
	if (isTransformOptions(value)) return getTransformObjectType(value, optionName);
	return "native";
};
const getTransformObjectType = (value, optionName) => {
	if (isDuplexStream(value.transform, { checkOpen: false })) return getDuplexType(value, optionName);
	if (isTransformStream(value.transform)) return getTransformStreamType(value, optionName);
	return getGeneratorObjectType(value, optionName);
};
const getDuplexType = (value, optionName) => {
	validateNonGeneratorType(value, optionName, "Duplex stream");
	return "duplex";
};
const getTransformStreamType = (value, optionName) => {
	validateNonGeneratorType(value, optionName, "web TransformStream");
	return "webTransform";
};
const validateNonGeneratorType = ({ final, binary, objectMode }, optionName, typeName) => {
	checkUndefinedOption(final, `${optionName}.final`, typeName);
	checkUndefinedOption(binary, `${optionName}.binary`, typeName);
	checkBooleanOption(objectMode, `${optionName}.objectMode`);
};
const checkUndefinedOption = (value, optionName, typeName) => {
	if (value !== void 0) throw new TypeError(`The \`${optionName}\` option can only be defined when using a generator, not a ${typeName}.`);
};
const getGeneratorObjectType = ({ transform, final, binary, objectMode }, optionName) => {
	if (transform !== void 0 && !isGenerator(transform)) throw new TypeError(`The \`${optionName}.transform\` option must be a generator, a Duplex stream or a web TransformStream.`);
	if (isDuplexStream(final, { checkOpen: false })) throw new TypeError(`The \`${optionName}.final\` option must not be a Duplex stream.`);
	if (isTransformStream(final)) throw new TypeError(`The \`${optionName}.final\` option must not be a web TransformStream.`);
	if (final !== void 0 && !isGenerator(final)) throw new TypeError(`The \`${optionName}.final\` option must be a generator.`);
	checkBooleanOption(binary, `${optionName}.binary`);
	checkBooleanOption(objectMode, `${optionName}.objectMode`);
	return isAsyncGenerator(transform) || isAsyncGenerator(final) ? "asyncGenerator" : "generator";
};
const checkBooleanOption = (value, optionName) => {
	if (value !== void 0 && typeof value !== "boolean") throw new TypeError(`The \`${optionName}\` option must use a boolean.`);
};
const isGenerator = (value) => isAsyncGenerator(value) || isSyncGenerator(value);
const isAsyncGenerator = (value) => Object.prototype.toString.call(value) === "[object AsyncGeneratorFunction]";
const isSyncGenerator = (value) => Object.prototype.toString.call(value) === "[object GeneratorFunction]";
const isTransformOptions = (value) => isPlainObject(value) && (value.transform !== void 0 || value.final !== void 0);
const isUrl = (value) => Object.prototype.toString.call(value) === "[object URL]";
const isRegularUrl = (value) => isUrl(value) && value.protocol !== "file:";
const isFilePathObject = (value) => isPlainObject(value) && Object.keys(value).length > 0 && Object.keys(value).every((key) => FILE_PATH_KEYS.has(key)) && isFilePathString(value.file);
const FILE_PATH_KEYS = new Set(["file", "append"]);
const isFilePathString = (file) => typeof file === "string";
const isStdioValueObject = (value) => isPlainObject(value) && Object.keys(value).length > 0 && Object.keys(value).every((key) => STDIO_VALUE_KEYS.has(key)) && "value" in value;
const STDIO_VALUE_KEYS = new Set(["value", "input"]);
const isUnknownStdioString = (type, value) => type === "native" && typeof value === "string" && !KNOWN_STDIO_STRINGS.has(value);
const KNOWN_STDIO_STRINGS = new Set([
	"ipc",
	"ignore",
	"inherit",
	"overlapped",
	"pipe"
]);
const isReadableStream = (value) => Object.prototype.toString.call(value) === "[object ReadableStream]";
const isWritableStream = (value) => Object.prototype.toString.call(value) === "[object WritableStream]";
const isWebStream = (value) => isReadableStream(value) || isWritableStream(value);
const isTransformStream = (value) => isReadableStream(value?.readable) && isWritableStream(value?.writable);
const isAsyncIterableObject = (value) => isObject(value) && typeof value[Symbol.asyncIterator] === "function";
const isIterableObject = (value) => isObject(value) && typeof value[Symbol.iterator] === "function";
const isObject = (value) => typeof value === "object" && value !== null;
const TRANSFORM_TYPES = new Set([
	"generator",
	"asyncGenerator",
	"duplex",
	"webTransform"
]);
const FILE_TYPES = new Set([
	"fileUrl",
	"filePath",
	"fileNumber"
]);
const SPECIAL_DUPLICATE_TYPES_SYNC = new Set(["fileUrl", "filePath"]);
const SPECIAL_DUPLICATE_TYPES = new Set([
	...SPECIAL_DUPLICATE_TYPES_SYNC,
	"webStream",
	"nodeStream"
]);
const FORBID_DUPLICATE_TYPES = new Set(["webTransform", "duplex"]);
const TYPE_TO_MESSAGE = {
	generator: "a generator",
	asyncGenerator: "an async generator",
	fileUrl: "a file URL",
	filePath: "a file path string",
	fileNumber: "a file descriptor number",
	webStream: "a web stream",
	nodeStream: "a Node.js stream",
	webTransform: "a web TransformStream",
	duplex: "a Duplex stream",
	native: "any value",
	iterable: "an iterable",
	asyncIterable: "an async iterable",
	string: "a string",
	uint8Array: "a Uint8Array"
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/transform/object-mode.js
const getTransformObjectModes = (objectMode, index, newTransforms, direction) => direction === "output" ? getOutputObjectModes(objectMode, index, newTransforms) : getInputObjectModes(objectMode, index, newTransforms);
const getOutputObjectModes = (objectMode, index, newTransforms) => {
	const writableObjectMode = index !== 0 && newTransforms[index - 1].value.readableObjectMode;
	return {
		writableObjectMode,
		readableObjectMode: objectMode ?? writableObjectMode
	};
};
const getInputObjectModes = (objectMode, index, newTransforms) => {
	const writableObjectMode = index === 0 ? objectMode === true : newTransforms[index - 1].value.readableObjectMode;
	return {
		writableObjectMode,
		readableObjectMode: index !== newTransforms.length - 1 && (objectMode ?? writableObjectMode)
	};
};
const getFdObjectMode = (stdioItems, direction) => {
	const lastTransform = stdioItems.findLast(({ type }) => TRANSFORM_TYPES.has(type));
	if (lastTransform === void 0) return false;
	return direction === "input" ? lastTransform.value.writableObjectMode : lastTransform.value.readableObjectMode;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/transform/normalize.js
const normalizeTransforms = (stdioItems, optionName, direction, options) => [...stdioItems.filter(({ type }) => !TRANSFORM_TYPES.has(type)), ...getTransforms(stdioItems, optionName, direction, options)];
const getTransforms = (stdioItems, optionName, direction, { encoding }) => {
	const transforms = stdioItems.filter(({ type }) => TRANSFORM_TYPES.has(type));
	const newTransforms = Array.from({ length: transforms.length });
	for (const [index, stdioItem] of Object.entries(transforms)) newTransforms[index] = normalizeTransform({
		stdioItem,
		index: Number(index),
		newTransforms,
		optionName,
		direction,
		encoding
	});
	return sortTransforms(newTransforms, direction);
};
const normalizeTransform = ({ stdioItem, stdioItem: { type }, index, newTransforms, optionName, direction, encoding }) => {
	if (type === "duplex") return normalizeDuplex({
		stdioItem,
		optionName
	});
	if (type === "webTransform") return normalizeTransformStream({
		stdioItem,
		index,
		newTransforms,
		direction
	});
	return normalizeGenerator({
		stdioItem,
		index,
		newTransforms,
		direction,
		encoding
	});
};
const normalizeDuplex = ({ stdioItem, optionName }) => {
	const { value } = stdioItem;
	const { transform } = value;
	const { writableObjectMode, readableObjectMode } = transform;
	const { objectMode = readableObjectMode } = value;
	if (objectMode && !readableObjectMode) throw new TypeError(`The \`${optionName}.objectMode\` option can only be \`true\` if \`new Duplex({objectMode: true})\` is used.`);
	if (!objectMode && readableObjectMode) throw new TypeError(`The \`${optionName}.objectMode\` option cannot be \`false\` if \`new Duplex({objectMode: true})\` is used.`);
	return {
		...stdioItem,
		value: {
			transform,
			writableObjectMode,
			readableObjectMode
		}
	};
};
const normalizeTransformStream = ({ stdioItem, stdioItem: { value }, index, newTransforms, direction }) => {
	const { transform, objectMode } = isPlainObject(value) ? value : { transform: value };
	const { writableObjectMode, readableObjectMode } = getTransformObjectModes(objectMode, index, newTransforms, direction);
	return {
		...stdioItem,
		value: {
			transform,
			writableObjectMode,
			readableObjectMode
		}
	};
};
const normalizeGenerator = ({ stdioItem, stdioItem: { value }, index, newTransforms, direction, encoding }) => {
	const { transform, final, binary: binaryOption = false, preserveNewlines = false, objectMode } = isPlainObject(value) ? value : { transform: value };
	const binary = binaryOption || BINARY_ENCODINGS.has(encoding);
	const { writableObjectMode, readableObjectMode } = getTransformObjectModes(objectMode, index, newTransforms, direction);
	return {
		...stdioItem,
		value: {
			transform,
			final,
			binary,
			preserveNewlines,
			writableObjectMode,
			readableObjectMode
		}
	};
};
const sortTransforms = (newTransforms, direction) => direction === "input" ? newTransforms.reverse() : newTransforms;

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/stdio/direction.js
const getStreamDirection = (stdioItems, fdNumber, optionName) => {
	const directions = stdioItems.map((stdioItem) => getStdioItemDirection(stdioItem, fdNumber));
	if (directions.includes("input") && directions.includes("output")) throw new TypeError(`The \`${optionName}\` option must not be an array of both readable and writable values.`);
	return directions.find(Boolean) ?? DEFAULT_DIRECTION;
};
const getStdioItemDirection = (stdioItem, fdNumber) => KNOWN_DIRECTIONS[fdNumber] ?? getRequestedDirection(stdioItem);
const getRequestedDirection = ({ type, value, direction, optionName }) => {
	const guessedDirection = guessStreamDirection[type](value);
	if (direction === "input" && guessedDirection === "output") throw new TypeError(`The \`${optionName}\` option is invalid: \`input: true\` cannot be used with a writable value, which is always an output.`);
	return direction ?? guessedDirection;
};
const KNOWN_DIRECTIONS = [
	"input",
	"output",
	"output"
];
const anyDirection = () => void 0;
const alwaysInput = () => "input";
const guessStreamDirection = {
	generator: anyDirection,
	asyncGenerator: anyDirection,
	fileUrl: anyDirection,
	filePath: anyDirection,
	iterable: alwaysInput,
	asyncIterable: alwaysInput,
	uint8Array: alwaysInput,
	webStream: (value) => isWritableStream(value) ? "output" : "input",
	nodeStream(value) {
		if (!isReadableStream$1(value, { checkOpen: false })) return "output";
		return isWritableStream$1(value, { checkOpen: false }) ? void 0 : "input";
	},
	webTransform: anyDirection,
	duplex: anyDirection,
	native(value) {
		const standardStreamDirection = getStandardStreamDirection(value);
		if (standardStreamDirection !== void 0) return standardStreamDirection;
		if (isStream(value, { checkOpen: false })) return guessStreamDirection.nodeStream(value);
	}
};
const getStandardStreamDirection = (value) => {
	if ([0, process$1.stdin].includes(value)) return "input";
	if ([
		1,
		2,
		process$1.stdout,
		process$1.stderr
	].includes(value)) return "output";
};
const DEFAULT_DIRECTION = "output";

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/ipc/array.js
const normalizeIpcStdioArray = (stdioArray, ipc) => ipc ? [...stdioArray, "ipc"] : stdioArray;

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/stdio/stdio-option.js
const normalizeStdioOption = ({ stdio, ipc, buffer, ...options }, verboseInfo, isSync) => {
	const stdioArray = getStdioArray(stdio, options).map((stdioOption, fdNumber) => addDefaultValue(stdioOption, fdNumber));
	validateIpcStdioOption(stdioArray);
	return isSync ? normalizeStdioSync(stdioArray, buffer, verboseInfo) : normalizeIpcStdioArray(stdioArray, ipc);
};
const validateIpcStdioOption = (stdioArray) => {
	if (stdioArray.some((stdioOption) => hasIpcStdioOption(stdioOption))) throw new Error("The `ipc: true` option must be used instead of `stdio: 'ipc'`.");
};
const hasIpcStdioOption = (stdioOption) => {
	if (Array.isArray(stdioOption)) return stdioOption.some((item) => hasIpcStdioItem(item));
	return hasIpcStdioItem(stdioOption);
};
const hasIpcStdioItem = (stdioOption) => {
	if (isStdioValueObject(stdioOption)) return stdioOption.value === "ipc";
	return stdioOption === "ipc";
};
const getStdioArray = (stdio, options) => {
	if (stdio === void 0) return STANDARD_STREAMS_ALIASES.map((alias) => options[alias]);
	if (hasAlias(options)) throw new Error(`It's not possible to provide \`stdio\` in combination with one of ${STANDARD_STREAMS_ALIASES.map((alias) => `\`${alias}\``).join(", ")}`);
	if (typeof stdio === "string") return [
		stdio,
		stdio,
		stdio
	];
	if (!Array.isArray(stdio)) throw new TypeError(`Expected \`stdio\` to be of type \`string\` or \`Array\`, got \`${typeof stdio}\``);
	const length = Math.max(stdio.length, STANDARD_STREAMS_ALIASES.length);
	return Array.from({ length }, (_, fdNumber) => stdio[fdNumber]);
};
const hasAlias = (options) => STANDARD_STREAMS_ALIASES.some((alias) => options[alias] !== void 0);
const addDefaultValue = (stdioOption, fdNumber) => {
	if (Array.isArray(stdioOption)) return stdioOption.map((item) => addDefaultValue(item, fdNumber));
	if (stdioOption === null || stdioOption === void 0) return fdNumber >= STANDARD_STREAMS_ALIASES.length ? "ignore" : "pipe";
	return stdioOption;
};
const normalizeStdioSync = (stdioArray, buffer, verboseInfo) => stdioArray.map((stdioOption, fdNumber) => !buffer[fdNumber] && fdNumber !== 0 && !isFullVerbose(verboseInfo, fdNumber) && isOutputPipeOnly(stdioOption, fdNumber) ? "ignore" : stdioOption);
const isOutputPipeOnly = (stdioOption, fdNumber) => isOutputPipe(stdioOption, fdNumber) || Array.isArray(stdioOption) && stdioOption.every((item) => isOutputPipe(item, fdNumber));
const isOutputPipe = (stdioOption, fdNumber) => stdioOption === "pipe" || isOutputPipeObject(stdioOption, fdNumber);
const isOutputPipeObject = (stdioOption, fdNumber) => isStdioValueObject(stdioOption) && stdioOption.value === "pipe" && (stdioOption.input === void 0 || stdioOption.input === false || isFixedOutputPipe(fdNumber, stdioOption.input));
const isFixedOutputPipe = (fdNumber, input) => input === true && (fdNumber === 1 || fdNumber === 2);

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/arguments/fd-options.js
const getToStream = (destination, to = "stdin") => {
	const isWritable = true;
	const { options, fileDescriptors } = SUBPROCESS_OPTIONS.get(destination);
	const fdNumber = getFdNumber(fileDescriptors, to, isWritable);
	const destinationStream = destination.stdio[fdNumber];
	if (destinationStream === null) throw new TypeError(getInvalidStdioOptionMessage(fdNumber, to, options, isWritable));
	return destinationStream;
};
const getFromStream = (source, from = "stdout") => {
	const isWritable = false;
	const { options, fileDescriptors } = SUBPROCESS_OPTIONS.get(source);
	const fdNumber = getFdNumber(fileDescriptors, from, isWritable);
	const sourceStream = fdNumber === "all" ? source.all : source.stdio[fdNumber];
	if (sourceStream === null || sourceStream === void 0) throw new TypeError(getInvalidStdioOptionMessage(fdNumber, from, options, isWritable));
	return sourceStream;
};
const SUBPROCESS_OPTIONS = /* @__PURE__ */ new WeakMap();
const getFdNumber = (fileDescriptors, fdName, isWritable) => {
	const fdNumber = parseFdNumber(fdName, isWritable);
	validateFdNumber(fdNumber, fdName, isWritable, fileDescriptors);
	return fdNumber;
};
const parseFdNumber = (fdName, isWritable) => {
	const fdNumber = parseFd(fdName);
	if (fdNumber !== void 0) return fdNumber;
	const { validOptions, defaultValue } = isWritable ? {
		validOptions: "\"stdin\"",
		defaultValue: "stdin"
	} : {
		validOptions: "\"stdout\", \"stderr\", \"all\"",
		defaultValue: "stdout"
	};
	throw new TypeError(`"${getOptionName(isWritable)}" must not be "${fdName}".
It must be ${validOptions} or "fd3", "fd4" (and so on).
It is optional and defaults to "${defaultValue}".`);
};
const validateFdNumber = (fdNumber, fdName, isWritable, fileDescriptors) => {
	const fileDescriptor = fileDescriptors[getUsedDescriptor(fdNumber)];
	if (fileDescriptor === void 0) throw new TypeError(`"${getOptionName(isWritable)}" must not be ${fdName}. That file descriptor does not exist.
Please set the "stdio" option to ensure that file descriptor exists.`);
	if (fileDescriptor.direction === "input" && !isWritable) throw new TypeError(`"${getOptionName(isWritable)}" must not be ${fdName}. It must be a readable stream, not writable.`);
	if (fileDescriptor.direction !== "input" && isWritable) throw new TypeError(`"${getOptionName(isWritable)}" must not be ${fdName}. It must be a writable stream, not readable.
If you meant to use it as input, please set its "stdio" option to \`{value: 'pipe', input: true}\`.`);
};
const getInvalidStdioOptionMessage = (fdNumber, fdName, options, isWritable) => {
	if (fdNumber === "all" && !options.all) return "The \"all\" option must be true to use \"from: 'all'\".";
	const { optionName, optionValue } = getInvalidStdioOption(fdNumber, options);
	return `The "${optionName}: ${serializeOptionValue(optionValue)}" option is incompatible with using "${getOptionName(isWritable)}: ${serializeOptionValue(fdName)}".
Please set this option with "pipe" instead.`;
};
const getInvalidStdioOption = (fdNumber, { stdin, stdout, stderr, stdio }) => {
	const usedDescriptor = getUsedDescriptor(fdNumber);
	if (usedDescriptor === 0 && stdin !== void 0) return {
		optionName: "stdin",
		optionValue: stdin
	};
	if (usedDescriptor === 1 && stdout !== void 0) return {
		optionName: "stdout",
		optionValue: stdout
	};
	if (usedDescriptor === 2 && stderr !== void 0) return {
		optionName: "stderr",
		optionValue: stderr
	};
	return {
		optionName: `stdio[${usedDescriptor}]`,
		optionValue: stdio[usedDescriptor]
	};
};
const getUsedDescriptor = (fdNumber) => fdNumber === "all" ? 1 : fdNumber;
const getOptionName = (isWritable) => isWritable ? "to" : "from";
const serializeOptionValue = (value) => {
	if (typeof value === "string") return `'${value}'`;
	return typeof value === "number" ? `${value}` : "Stream";
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/stdio/native.js
const handleNativeStream = ({ stdioItem, stdioItem: { type }, isStdioArray, fdNumber, direction, isSync }) => {
	if (!isStdioArray || type !== "native") return stdioItem;
	return isSync ? handleNativeStreamSync({
		stdioItem,
		fdNumber,
		direction
	}) : handleNativeStreamAsync({
		stdioItem,
		fdNumber
	});
};
const handleNativeStreamSync = ({ stdioItem, stdioItem: { value, optionName }, fdNumber, direction }) => {
	const targetFd = getTargetFd({
		value,
		optionName,
		fdNumber,
		direction
	});
	if (targetFd !== void 0) return targetFd;
	if (isStream(value, { checkOpen: false })) throw new TypeError(`The \`${optionName}: Stream\` option cannot both be an array and include a stream with synchronous methods.`);
	return stdioItem;
};
const getTargetFd = ({ value, optionName, fdNumber, direction }) => {
	const targetFdNumber = getTargetFdNumber(value, fdNumber);
	if (targetFdNumber === void 0) return;
	if (direction === "output") return {
		type: "fileNumber",
		value: targetFdNumber,
		optionName
	};
	if (tty.isatty(targetFdNumber)) throw new TypeError(`The \`${optionName}: ${serializeOptionValue(value)}\` option is invalid: it cannot be a TTY with synchronous methods.`);
	return {
		type: "uint8Array",
		value: bufferToUint8Array(readFileSync(targetFdNumber)),
		optionName
	};
};
const getTargetFdNumber = (value, fdNumber) => {
	if (value === "inherit") return fdNumber;
	if (typeof value === "number") return value;
	const standardStreamIndex = STANDARD_STREAMS.indexOf(value);
	if (standardStreamIndex !== -1) return standardStreamIndex;
};
const handleNativeStreamAsync = ({ stdioItem, stdioItem: { value, optionName }, fdNumber }) => {
	if (value === "inherit") return {
		type: "nodeStream",
		value: getStandardStream(fdNumber, value, optionName),
		optionName
	};
	if (typeof value === "number") return {
		type: "nodeStream",
		value: getStandardStream(value, value, optionName),
		optionName
	};
	if (isStream(value, { checkOpen: false })) return {
		type: "nodeStream",
		value,
		optionName
	};
	return stdioItem;
};
const getStandardStream = (fdNumber, value, optionName) => {
	const standardStream = STANDARD_STREAMS[fdNumber];
	if (standardStream === void 0) throw new TypeError(`The \`${optionName}: ${value}\` option is invalid: no such standard stream.`);
	return standardStream;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/stdio/input-option.js
const handleInputOptions = ({ input, inputFile }, fdNumber) => fdNumber === 0 ? [...handleInputOption(input), ...handleInputFileOption(inputFile)] : [];
const handleInputOption = (input) => input === void 0 ? [] : [{
	type: getInputType(input),
	value: input,
	optionName: "input"
}];
const getInputType = (input) => {
	if (isReadableStream$1(input, { checkOpen: false })) return "nodeStream";
	if (typeof input === "string") return "string";
	if (isUint8Array(input)) return "uint8Array";
	throw new Error("The `input` option must be a string, a Uint8Array or a Node.js Readable stream.");
};
const handleInputFileOption = (inputFile) => inputFile === void 0 ? [] : [{
	...getInputFileType(inputFile),
	optionName: "inputFile"
}];
const getInputFileType = (inputFile) => {
	if (isUrl(inputFile)) return {
		type: "fileUrl",
		value: inputFile
	};
	if (isFilePathString(inputFile)) return {
		type: "filePath",
		value: { file: inputFile }
	};
	throw new Error("The `inputFile` option must be a file path string or a file URL.");
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/stdio/duplicate.js
const filterDuplicates = (stdioItems) => stdioItems.filter((stdioItemOne, indexOne) => stdioItems.every((stdioItemTwo, indexTwo) => !hasSameValueAndDirection(stdioItemOne, stdioItemTwo) || indexOne >= indexTwo || stdioItemOne.type === "generator" || stdioItemOne.type === "asyncGenerator"));
const hasSameValueAndDirection = (stdioItemOne, stdioItemTwo) => stdioItemOne.value === stdioItemTwo.value && stdioItemOne.direction === stdioItemTwo.direction;
const getDuplicateStream = ({ stdioItem: { type, value, optionName }, direction, fileDescriptors, isSync }) => {
	const otherStdioItems = getOtherStdioItems(fileDescriptors, type);
	if (otherStdioItems.length === 0) return;
	if (isSync) {
		validateDuplicateStreamSync({
			otherStdioItems,
			type,
			value,
			optionName,
			direction
		});
		return;
	}
	if (SPECIAL_DUPLICATE_TYPES.has(type)) return getDuplicateStreamInstance({
		otherStdioItems,
		type,
		value,
		optionName,
		direction
	});
	if (FORBID_DUPLICATE_TYPES.has(type)) validateDuplicateTransform({
		otherStdioItems,
		type,
		value,
		optionName
	});
};
const getOtherStdioItems = (fileDescriptors, type) => fileDescriptors.flatMap(({ direction, stdioItems }) => stdioItems.filter((stdioItem) => stdioItem.type === type).map(((stdioItem) => ({
	...stdioItem,
	direction
}))));
const validateDuplicateStreamSync = ({ otherStdioItems, type, value, optionName, direction }) => {
	if (SPECIAL_DUPLICATE_TYPES_SYNC.has(type)) getDuplicateStreamInstance({
		otherStdioItems,
		type,
		value,
		optionName,
		direction
	});
};
const getDuplicateStreamInstance = ({ otherStdioItems, type, value, optionName, direction }) => {
	const duplicateStdioItems = otherStdioItems.filter((stdioItem) => hasSameValue(stdioItem, value));
	if (duplicateStdioItems.length === 0) return;
	throwOnDuplicateStream(duplicateStdioItems.find((stdioItem) => stdioItem.direction !== direction), optionName, type);
	return direction === "output" ? duplicateStdioItems[0].stream : void 0;
};
const hasSameValue = ({ type, value }, secondValue) => {
	if (type === "filePath") return value.file === secondValue.file;
	if (type === "fileUrl") return value.href === secondValue.href;
	return value === secondValue;
};
const validateDuplicateTransform = ({ otherStdioItems, type, value, optionName }) => {
	throwOnDuplicateStream(otherStdioItems.find(({ value: { transform } }) => transform === value.transform), optionName, type);
};
const throwOnDuplicateStream = (stdioItem, optionName, type) => {
	if (stdioItem !== void 0) throw new TypeError(`The \`${stdioItem.optionName}\` and \`${optionName}\` options must not target ${TYPE_TO_MESSAGE[type]} that is the same.`);
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/stdio/handle.js
const handleStdio = (addProperties, options, verboseInfo, isSync) => {
	const fileDescriptors = getFinalFileDescriptors({
		initialFileDescriptors: normalizeStdioOption(options, verboseInfo, isSync).map((stdioOption, fdNumber) => getFileDescriptor({
			stdioOption,
			fdNumber,
			options,
			isSync
		})),
		addProperties,
		options,
		isSync
	});
	options.stdio = fileDescriptors.map(({ stdioItems }) => forwardStdio(stdioItems));
	return fileDescriptors;
};
const getFileDescriptor = ({ stdioOption, fdNumber, options, isSync }) => {
	const optionName = getStreamName(fdNumber);
	const { stdioItems: initialStdioItems, isStdioArray } = initializeStdioItems({
		stdioOption,
		fdNumber,
		options,
		optionName
	});
	const direction = getStreamDirection(initialStdioItems, fdNumber, optionName);
	const normalizedStdioItems = normalizeTransforms(initialStdioItems.map((stdioItem) => handleNativeStream({
		stdioItem,
		isStdioArray,
		fdNumber,
		direction,
		isSync
	})), optionName, direction, options);
	const objectMode = getFdObjectMode(normalizedStdioItems, direction);
	validateFileObjectMode(normalizedStdioItems, objectMode);
	return {
		direction,
		objectMode,
		stdioItems: normalizedStdioItems
	};
};
const initializeStdioItems = ({ stdioOption, fdNumber, options, optionName }) => {
	const values = Array.isArray(stdioOption) ? stdioOption : [stdioOption];
	const inputStdioItems = handleInputOptions(options, fdNumber);
	const stdioItems = filterDuplicates([...omitInheritedStdin(values.map((value) => initializeStdioItem(value, optionName)), inputStdioItems), ...inputStdioItems]);
	const isStdioArray = stdioItems.length > 1;
	validateStdioArray(stdioItems, isStdioArray, optionName);
	validateStreams(stdioItems);
	return {
		stdioItems,
		isStdioArray
	};
};
const omitInheritedStdin = (stdioItems, inputStdioItems) => inputStdioItems.length > 0 && isInheritedStdinOnly(stdioItems) ? [] : stdioItems;
const isInheritedStdinOnly = (stdioItems) => stdioItems.length === 1 && stdioItems[0].type === "native" && stdioItems[0].value === "inherit";
const initializeStdioItem = (value, optionName) => {
	if (isStdioValueObject(value)) return initializeStdioValueObject(value, optionName);
	return {
		type: getStdioItemType(value, optionName),
		value,
		optionName
	};
};
const initializeStdioValueObject = ({ value, input }, optionName) => {
	checkBooleanOption(input, `${optionName}.input`);
	return {
		type: getStdioItemType(value, optionName),
		value,
		direction: input ? "input" : void 0,
		optionName
	};
};
const validateStdioArray = (stdioItems, isStdioArray, optionName) => {
	if (stdioItems.length === 0) throw new TypeError(`The \`${optionName}\` option must not be an empty array.`);
	if (!isStdioArray) return;
	for (const { value, optionName } of stdioItems) if (INVALID_STDIO_ARRAY_OPTIONS.has(value)) throw new Error(`The \`${optionName}\` option must not include \`${value}\`.`);
};
const INVALID_STDIO_ARRAY_OPTIONS = new Set(["ignore"]);
const validateStreams = (stdioItems) => {
	for (const stdioItem of stdioItems) validateFileStdio(stdioItem);
};
const validateFileStdio = ({ type, value, optionName }) => {
	if (isRegularUrl(value)) throw new TypeError(`The \`${optionName}: URL\` option must use the \`file:\` scheme.
For example, you can use the \`pathToFileURL()\` method of the \`url\` core module.`);
	if (isUnknownStdioString(type, value)) throw new TypeError(`The \`${optionName}: { file: '...' }\` option must be used instead of \`${optionName}: '...'\`.`);
};
const validateFileObjectMode = (stdioItems, objectMode) => {
	if (!objectMode) return;
	const fileStdioItem = stdioItems.find(({ type }) => FILE_TYPES.has(type));
	if (fileStdioItem !== void 0) throw new TypeError(`The \`${fileStdioItem.optionName}\` option cannot use both files and transforms in objectMode.`);
};
const getFinalFileDescriptors = ({ initialFileDescriptors, addProperties, options, isSync }) => {
	const fileDescriptors = [];
	try {
		for (const fileDescriptor of initialFileDescriptors) fileDescriptors.push(getFinalFileDescriptor({
			fileDescriptor,
			fileDescriptors,
			addProperties,
			options,
			isSync
		}));
		return fileDescriptors;
	} catch (error) {
		cleanupCustomStreams(fileDescriptors);
		throw error;
	}
};
const getFinalFileDescriptor = ({ fileDescriptor: { direction, objectMode, stdioItems }, fileDescriptors, addProperties, options, isSync }) => {
	return {
		direction,
		objectMode,
		stdioItems: stdioItems.map((stdioItem) => addStreamProperties({
			stdioItem,
			addProperties,
			direction,
			options,
			fileDescriptors,
			isSync
		}))
	};
};
const addStreamProperties = ({ stdioItem, addProperties, direction, options, fileDescriptors, isSync }) => {
	const duplicateStream = getDuplicateStream({
		stdioItem,
		direction,
		fileDescriptors,
		isSync
	});
	if (duplicateStream !== void 0) return {
		...stdioItem,
		stream: duplicateStream
	};
	return {
		...stdioItem,
		...addProperties[direction][stdioItem.type](stdioItem, options)
	};
};
const cleanupCustomStreams = (fileDescriptors) => {
	for (const { stdioItems } of fileDescriptors) for (const { stream } of stdioItems) if (stream !== void 0 && !isStandardStream(stream)) stream.destroy();
};
const forwardStdio = (stdioItems) => {
	if (stdioItems.length > 1) return stdioItems.some(({ value }) => value === "overlapped") ? "overlapped" : "pipe";
	const [{ type, value }] = stdioItems;
	return type === "native" ? value : "pipe";
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/stdio/handle-sync.js
const handleStdioSync = (options, verboseInfo) => handleStdio(addPropertiesSync, options, verboseInfo, true);
const forbiddenIfSync = ({ type, optionName }) => {
	throwInvalidSyncValue(optionName, TYPE_TO_MESSAGE[type]);
};
const forbiddenNativeIfSync = ({ optionName, value }) => {
	if (value === "overlapped") throwInvalidSyncValue(optionName, `"${value}"`);
	return {};
};
const forbiddenNativeInputIfSync = (stdioItem) => {
	const { optionName, value } = stdioItem;
	if (value === "pipe" && optionName !== "stdin") throw new TypeError(`Only the \`stdin\` option, not \`${optionName}\`, can be an input pipe with synchronous methods.`);
	return forbiddenNativeIfSync(stdioItem);
};
const throwInvalidSyncValue = (optionName, value) => {
	throw new TypeError(`The \`${optionName}\` option cannot be ${value} with synchronous methods.`);
};
const addProperties$1 = {
	generator() {},
	asyncGenerator: forbiddenIfSync,
	webStream: forbiddenIfSync,
	nodeStream: forbiddenIfSync,
	webTransform: forbiddenIfSync,
	duplex: forbiddenIfSync,
	asyncIterable: forbiddenIfSync,
	native: forbiddenNativeIfSync
};
const addPropertiesSync = {
	input: {
		...addProperties$1,
		native: forbiddenNativeInputIfSync,
		fileUrl: ({ value }) => ({ contents: [bufferToUint8Array(readFileSync(value))] }),
		filePath: ({ value: { file } }) => ({ contents: [bufferToUint8Array(readFileSync(file))] }),
		fileNumber: forbiddenIfSync,
		iterable: ({ value }) => ({ contents: [...value] }),
		string: ({ value }) => ({ contents: [value] }),
		uint8Array: ({ value }) => ({ contents: [value] })
	},
	output: {
		...addProperties$1,
		fileUrl: ({ value }) => ({ path: value }),
		filePath: ({ value: { file, append } }) => ({
			path: file,
			append
		}),
		fileNumber: ({ value }) => ({ path: value }),
		iterable: forbiddenIfSync,
		string: forbiddenIfSync,
		uint8Array: forbiddenIfSync
	}
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/io/strip-newline.js
const stripNewline = (value, { stripFinalNewline: stripFinalNewline$1 }, fdNumber) => getStripFinalNewline(stripFinalNewline$1, fdNumber) && value !== void 0 && !Array.isArray(value) ? stripFinalNewline(value) : value;
const getStripFinalNewline = (stripFinalNewline, fdNumber) => fdNumber === "all" ? stripFinalNewline[1] || stripFinalNewline[2] : stripFinalNewline[fdNumber];

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/transform/split.js
const getSplitLinesGenerator = (binary, preserveNewlines, skipped, state) => binary || skipped ? void 0 : initializeSplitLines(preserveNewlines, state);
const splitLinesSync = (chunk, preserveNewlines, objectMode) => objectMode ? chunk.flatMap((item) => splitLinesItemSync(item, preserveNewlines)) : splitLinesItemSync(chunk, preserveNewlines);
const splitLinesItemSync = (chunk, preserveNewlines) => {
	const { transform, final } = initializeSplitLines(preserveNewlines, {});
	return [...transform(chunk), ...final()];
};
const initializeSplitLines = (preserveNewlines, state) => {
	state.previousChunks = "";
	return {
		transform: splitGenerator.bind(void 0, state, preserveNewlines),
		final: linesFinal.bind(void 0, state)
	};
};
const splitGenerator = function* (state, preserveNewlines, chunk) {
	if (typeof chunk !== "string") {
		yield chunk;
		return;
	}
	let { previousChunks } = state;
	let start = -1;
	for (let end = 0; end < chunk.length; end += 1) {
		if (chunk[end] !== "\n") continue;
		const newlineLength = getNewlineLength(chunk, end, preserveNewlines, state);
		let line = chunk.slice(start + 1, end + 1 - newlineLength);
		if (previousChunks.length > 0) {
			line = concatString(previousChunks, line);
			previousChunks = "";
		}
		yield line;
		start = end;
	}
	if (start !== chunk.length - 1) previousChunks = concatString(previousChunks, chunk.slice(start + 1));
	state.previousChunks = previousChunks;
};
const getNewlineLength = (chunk, end, preserveNewlines, state) => {
	if (preserveNewlines) return 0;
	state.isWindowsNewline = end !== 0 && chunk[end - 1] === "\r";
	return state.isWindowsNewline ? 2 : 1;
};
const linesFinal = function* ({ previousChunks }) {
	if (previousChunks.length > 0) yield previousChunks;
};
const getAppendNewlineGenerator = ({ binary, preserveNewlines, readableObjectMode, state }) => binary || preserveNewlines || readableObjectMode ? void 0 : { transform: appendNewlineGenerator.bind(void 0, state) };
const appendNewlineGenerator = function* ({ isWindowsNewline = false }, chunk) {
	const { unixNewline, windowsNewline, LF, concatBytes } = typeof chunk === "string" ? linesStringInfo : linesUint8ArrayInfo;
	if (chunk.at(-1) === LF) {
		yield chunk;
		return;
	}
	yield concatBytes(chunk, isWindowsNewline ? windowsNewline : unixNewline);
};
const concatString = (firstChunk, secondChunk) => `${firstChunk}${secondChunk}`;
const linesStringInfo = {
	windowsNewline: "\r\n",
	unixNewline: "\n",
	LF: "\n",
	concatBytes: concatString
};
const concatUint8Array = (firstChunk, secondChunk) => {
	const chunk = new Uint8Array(firstChunk.length + secondChunk.length);
	chunk.set(firstChunk, 0);
	chunk.set(secondChunk, firstChunk.length);
	return chunk;
};
const linesUint8ArrayInfo = {
	windowsNewline: new Uint8Array([13, 10]),
	unixNewline: new Uint8Array([10]),
	LF: 10,
	concatBytes: concatUint8Array
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/transform/validate.js
const getValidateTransformInput = (writableObjectMode, optionName) => writableObjectMode ? void 0 : validateStringTransformInput.bind(void 0, optionName);
const validateStringTransformInput = function* (optionName, chunk) {
	if (typeof chunk !== "string" && !isUint8Array(chunk) && !Buffer.isBuffer(chunk)) throw new TypeError(`The \`${optionName}\` option's transform must use "objectMode: true" to receive as input: ${typeof chunk}.`);
	yield chunk;
};
const getValidateTransformReturn = (readableObjectMode, optionName) => readableObjectMode ? validateObjectTransformReturn.bind(void 0, optionName) : validateStringTransformReturn.bind(void 0, optionName);
const validateObjectTransformReturn = function* (optionName, chunk) {
	validateEmptyReturn(optionName, chunk);
	yield chunk;
};
const validateStringTransformReturn = function* (optionName, chunk) {
	validateEmptyReturn(optionName, chunk);
	if (typeof chunk !== "string" && !isUint8Array(chunk)) throw new TypeError(`The \`${optionName}\` option's function must yield a string or an Uint8Array, not ${typeof chunk}.`);
	yield chunk;
};
const validateEmptyReturn = (optionName, chunk) => {
	if (chunk === null || chunk === void 0) throw new TypeError(`The \`${optionName}\` option's function must not call \`yield ${chunk}\`.
Instead, \`yield\` should either be called with a value, or not be called at all. For example:
  if (condition) { yield value; }`);
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/transform/encoding-transform.js
const getEncodingTransformGenerator = (binary, encoding, skipped) => {
	if (skipped) return;
	if (binary) return { transform: encodingUint8ArrayGenerator.bind(void 0, new TextEncoder()) };
	const stringDecoder = new StringDecoder(encoding);
	return {
		transform: encodingStringGenerator.bind(void 0, stringDecoder),
		final: encodingStringFinal.bind(void 0, stringDecoder)
	};
};
const encodingUint8ArrayGenerator = function* (textEncoder, chunk) {
	if (Buffer.isBuffer(chunk)) yield bufferToUint8Array(chunk);
	else if (typeof chunk === "string") yield textEncoder.encode(chunk);
	else yield chunk;
};
const encodingStringGenerator = function* (stringDecoder, chunk) {
	yield isUint8Array(chunk) ? stringDecoder.write(chunk) : chunk;
};
const encodingStringFinal = function* (stringDecoder) {
	const lastChunk = stringDecoder.end();
	if (lastChunk !== "") yield lastChunk;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/transform/run-async.js
const pushChunks = callbackify(async (getChunks, state, getChunksArguments, transformStream) => {
	state.currentIterable = getChunks(...getChunksArguments);
	try {
		for await (const chunk of state.currentIterable) transformStream.push(chunk);
	} finally {
		delete state.currentIterable;
	}
});
const transformChunk = async function* (chunk, generators, index) {
	if (index === generators.length) {
		yield chunk;
		return;
	}
	const { transform = identityGenerator$1 } = generators[index];
	for await (const transformedChunk of transform(chunk)) yield* transformChunk(transformedChunk, generators, index + 1);
};
const finalChunks = async function* (generators) {
	for (const [index, { final }] of Object.entries(generators)) yield* generatorFinalChunks(final, Number(index), generators);
};
const generatorFinalChunks = async function* (final, index, generators) {
	if (final === void 0) return;
	for await (const finalChunk of final()) yield* transformChunk(finalChunk, generators, index + 1);
};
const destroyTransform = callbackify(async ({ currentIterable }, error) => {
	if (currentIterable !== void 0) {
		await (error ? currentIterable.throw(error) : currentIterable.return());
		return;
	}
	if (error) throw error;
});
const identityGenerator$1 = function* (chunk) {
	yield chunk;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/transform/run-sync.js
const pushChunksSync = (getChunksSync, getChunksArguments, transformStream, done) => {
	try {
		for (const chunk of getChunksSync(...getChunksArguments)) transformStream.push(chunk);
		done();
	} catch (error) {
		done(error);
	}
};
const runTransformSync = (generators, chunks) => [...chunks.flatMap((chunk) => [...transformChunkSync(chunk, generators, 0)]), ...finalChunksSync(generators)];
const transformChunkSync = function* (chunk, generators, index) {
	if (index === generators.length) {
		yield chunk;
		return;
	}
	const { transform = identityGenerator } = generators[index];
	for (const transformedChunk of transform(chunk)) yield* transformChunkSync(transformedChunk, generators, index + 1);
};
const finalChunksSync = function* (generators) {
	for (const [index, { final }] of Object.entries(generators)) yield* generatorFinalChunksSync(final, Number(index), generators);
};
const generatorFinalChunksSync = function* (final, index, generators) {
	if (final === void 0) return;
	for (const finalChunk of final()) yield* transformChunkSync(finalChunk, generators, index + 1);
};
const identityGenerator = function* (chunk) {
	yield chunk;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/transform/generator.js
const generatorToStream = ({ value, value: { transform, final, writableObjectMode, readableObjectMode }, optionName }, { encoding }) => {
	const state = {};
	const generators = addInternalGenerators(value, encoding, optionName);
	const transformAsync = isAsyncGenerator(transform);
	const finalAsync = isAsyncGenerator(final);
	const transformMethod = transformAsync ? pushChunks.bind(void 0, transformChunk, state) : pushChunksSync.bind(void 0, transformChunkSync);
	const finalMethod = transformAsync || finalAsync ? pushChunks.bind(void 0, finalChunks, state) : pushChunksSync.bind(void 0, finalChunksSync);
	const destroyMethod = transformAsync || finalAsync ? destroyTransform.bind(void 0, state) : void 0;
	return { stream: new Transform({
		writableObjectMode,
		writableHighWaterMark: getDefaultHighWaterMark(writableObjectMode),
		readableObjectMode,
		readableHighWaterMark: getDefaultHighWaterMark(readableObjectMode),
		transform(chunk, encoding, done) {
			transformMethod([
				chunk,
				generators,
				0
			], this, done);
		},
		flush(done) {
			finalMethod([generators], this, done);
		},
		destroy: destroyMethod
	}) };
};
const runGeneratorsSync = (chunks, stdioItems, encoding, isInput) => {
	const generators = stdioItems.filter(({ type }) => type === "generator");
	const reversedGenerators = isInput ? generators.reverse() : generators;
	for (const { value, optionName } of reversedGenerators) chunks = runTransformSync(addInternalGenerators(value, encoding, optionName), chunks);
	return chunks;
};
const addInternalGenerators = ({ transform, final, binary, writableObjectMode, readableObjectMode, preserveNewlines }, encoding, optionName) => {
	const state = {};
	return [
		{ transform: getValidateTransformInput(writableObjectMode, optionName) },
		getEncodingTransformGenerator(binary, encoding, writableObjectMode),
		getSplitLinesGenerator(binary, preserveNewlines, writableObjectMode, state),
		{
			transform,
			final
		},
		{ transform: getValidateTransformReturn(readableObjectMode, optionName) },
		getAppendNewlineGenerator({
			binary,
			preserveNewlines,
			readableObjectMode,
			state
		})
	].filter(Boolean);
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/io/input-sync.js
const addInputOptionsSync = (fileDescriptors, options) => {
	for (const fdNumber of getInputFdNumbers(fileDescriptors)) addInputOptionSync(fileDescriptors, fdNumber, options);
};
const getInputFdNumbers = (fileDescriptors) => new Set(Object.entries(fileDescriptors).filter(([, { direction }]) => direction === "input").map(([fdNumber]) => Number(fdNumber)));
const addInputOptionSync = (fileDescriptors, fdNumber, options) => {
	const { stdioItems } = fileDescriptors[fdNumber];
	const allStdioItems = stdioItems.filter(({ contents }) => contents !== void 0);
	if (allStdioItems.length === 0) return;
	if (fdNumber !== 0) {
		const [{ type, optionName }] = allStdioItems;
		throw new TypeError(`Only the \`stdin\` option, not \`${optionName}\`, can be ${TYPE_TO_MESSAGE[type]} with synchronous methods.`);
	}
	options.input = joinToUint8Array(allStdioItems.map(({ contents }) => contents).map((contents) => applySingleInputGeneratorsSync(contents, stdioItems)));
};
const applySingleInputGeneratorsSync = (contents, stdioItems) => {
	const newContents = runGeneratorsSync(contents, stdioItems, "utf8", true);
	validateSerializable(newContents);
	return joinToUint8Array(newContents);
};
const validateSerializable = (newContents) => {
	const invalidItem = newContents.find((item) => typeof item !== "string" && !isUint8Array(item));
	if (invalidItem !== void 0) throw new TypeError(`The \`stdin\` option is invalid: when passing objects as input, a transform must be used to serialize them to strings or Uint8Arrays: ${invalidItem}.`);
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/verbose/output.js
const shouldLogOutput = ({ stdioItems, encoding, verboseInfo, fdNumber }) => fdNumber !== "all" && isFullVerbose(verboseInfo, fdNumber) && !BINARY_ENCODINGS.has(encoding) && isFdVerbose(fdNumber) && (stdioItems.some(({ type, value }) => type === "native" && PIPED_STDIO_VALUES.has(value)) || stdioItems.every(({ type }) => TRANSFORM_TYPES.has(type)));
const isFdVerbose = (fdNumber) => fdNumber === 1 || fdNumber === 2;
const PIPED_STDIO_VALUES = new Set(["pipe", "overlapped"]);
const logLines = async (linesIterable, stream, fdNumber, verboseInfo) => {
	for await (const line of linesIterable) if (!isPipingStream(stream)) logLine(line, fdNumber, verboseInfo);
};
const logLinesSync = (linesArray, fdNumber, verboseInfo) => {
	for (const line of linesArray) logLine(line, fdNumber, verboseInfo);
};
const isPipingStream = (stream) => stream._readableState.pipes.length > 0;
const logLine = (line, fdNumber, verboseInfo) => {
	verboseLog({
		type: "output",
		verboseMessage: serializeVerboseMessage(line),
		fdNumber,
		verboseInfo
	});
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/io/output-sync.js
const transformOutputSync = ({ fileDescriptors, syncResult: { output }, options, isMaxBuffer, verboseInfo }) => {
	if (output === null) return { output: Array.from({ length: 3 }) };
	const state = {};
	const outputFiles = /* @__PURE__ */ new Set();
	return {
		output: output.map((result, fdNumber) => transformOutputResultSync({
			result,
			fileDescriptors,
			fdNumber,
			state,
			outputFiles,
			isMaxBuffer,
			verboseInfo
		}, options)),
		...state
	};
};
const transformOutputResultSync = ({ result, fileDescriptors, fdNumber, state, outputFiles, isMaxBuffer, verboseInfo }, { buffer, encoding, lines, stripFinalNewline, maxBuffer }) => {
	if (result === null) return;
	const uint8ArrayResult = bufferToUint8Array(truncateMaxBufferSync(result, isMaxBuffer, maxBuffer));
	const { stdioItems, objectMode } = fileDescriptors[fdNumber];
	const { serializedResult, finalResult = serializedResult } = serializeChunks({
		chunks: runOutputGeneratorsSync([uint8ArrayResult], stdioItems, encoding, state),
		objectMode,
		encoding,
		lines,
		stripFinalNewline,
		fdNumber
	});
	logOutputSync({
		serializedResult,
		fdNumber,
		state,
		verboseInfo,
		encoding,
		stdioItems,
		objectMode
	});
	const returnedResult = buffer[fdNumber] ? finalResult : void 0;
	try {
		if (state.error === void 0) writeToFiles(serializedResult, stdioItems, outputFiles);
		return returnedResult;
	} catch (error) {
		state.error = error;
		return returnedResult;
	}
};
const runOutputGeneratorsSync = (chunks, stdioItems, encoding, state) => {
	try {
		return runGeneratorsSync(chunks, stdioItems, encoding, false);
	} catch (error) {
		state.error = error;
		return chunks;
	}
};
const serializeChunks = ({ chunks, objectMode, encoding, lines, stripFinalNewline, fdNumber }) => {
	if (objectMode) return { serializedResult: chunks };
	if (encoding === "buffer") return { serializedResult: joinToUint8Array(chunks) };
	const serializedResult = joinToString(chunks, encoding);
	if (lines[fdNumber]) return {
		serializedResult,
		finalResult: splitLinesSync(serializedResult, !stripFinalNewline[fdNumber], objectMode)
	};
	return { serializedResult };
};
const logOutputSync = ({ serializedResult, fdNumber, state, verboseInfo, encoding, stdioItems, objectMode }) => {
	if (!shouldLogOutput({
		stdioItems,
		encoding,
		verboseInfo,
		fdNumber
	})) return;
	const linesArray = splitLinesSync(serializedResult, false, objectMode);
	try {
		logLinesSync(linesArray, fdNumber, verboseInfo);
	} catch (error) {
		state.error ??= error;
	}
};
const writeToFiles = (serializedResult, stdioItems, outputFiles) => {
	const fileItems = stdioItems.filter(({ type }) => FILE_TYPES.has(type));
	for (const { path, append } of fileItems) {
		const pathString = typeof path === "string" ? path : path.toString();
		if (append || outputFiles.has(pathString)) appendFileSync(path, serializedResult);
		else {
			outputFiles.add(pathString);
			writeFileSync(path, serializedResult);
		}
	}
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/resolve/all-sync.js
const getAllSync = ([, stdout, stderr], options) => {
	if (!options.all) return;
	if (stdout === void 0) return stderr;
	if (stderr === void 0) return stdout;
	if (Array.isArray(stdout)) return Array.isArray(stderr) ? [...stdout, ...stderr] : [...stdout, stripNewline(stderr, options, "all")];
	if (Array.isArray(stderr)) return [stripNewline(stdout, options, "all"), ...stderr];
	if (isUint8Array(stdout) && isUint8Array(stderr)) return concatUint8Arrays([stdout, stderr]);
	return `${stdout}${stderr}`;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/resolve/exit-async.js
const waitForExit = async (subprocess, context) => {
	const [exitCode, signal] = await waitForExitOrError(subprocess);
	context.isForcefullyTerminated ??= false;
	return [exitCode, signal];
};
const waitForExitOrError = async (subprocess) => {
	const [spawnPayload, exitPayload] = await Promise.allSettled([once(subprocess, "spawn"), once(subprocess, "exit")]);
	if (spawnPayload.status === "rejected") return [];
	return exitPayload.status === "rejected" ? waitForSubprocessExit(subprocess) : exitPayload.value;
};
const waitForSubprocessExit = async (subprocess) => {
	try {
		return await once(subprocess, "exit");
	} catch {
		return waitForSubprocessExit(subprocess);
	}
};
const waitForSuccessfulExit = async (exitPromise) => {
	const [exitCode, signal] = await exitPromise;
	if (!isSubprocessErrorExit(exitCode, signal) && isFailedExit(exitCode, signal)) throw new DiscardedError();
	return [exitCode, signal];
};
const isSubprocessErrorExit = (exitCode, signal) => exitCode === void 0 && signal === void 0;
const isFailedExit = (exitCode, signal) => exitCode !== 0 || signal !== null;

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/resolve/exit-sync.js
const getExitResultSync = ({ error, status: exitCode, signal, output }, { maxBuffer }) => {
	const resultError = getResultError(error, exitCode, signal);
	return {
		resultError,
		exitCode,
		signal,
		timedOut: resultError?.code === "ETIMEDOUT",
		isMaxBuffer: isMaxBufferSync(resultError, output, maxBuffer)
	};
};
const getResultError = (error, exitCode, signal) => {
	if (error !== void 0) return error;
	return isFailedExit(exitCode, signal) ? new DiscardedError() : void 0;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/methods/main-sync.js
const execaCoreSync = (rawFile, rawArguments, rawOptions) => {
	const { file, commandArguments, command, escapedCommand, startTime, verboseInfo, options, fileDescriptors } = handleSyncArguments(rawFile, rawArguments, rawOptions);
	return handleResult(spawnSubprocessSync({
		file,
		commandArguments,
		options,
		command,
		escapedCommand,
		verboseInfo,
		fileDescriptors,
		startTime
	}), verboseInfo, options);
};
const handleSyncArguments = (rawFile, rawArguments, rawOptions) => {
	const { command, escapedCommand, startTime, verboseInfo } = handleCommand(rawFile, rawArguments, rawOptions);
	const { file, commandArguments, options } = normalizeOptions(rawFile, rawArguments, normalizeSyncOptions(rawOptions));
	validateSyncOptions(options);
	return {
		file,
		commandArguments,
		command,
		escapedCommand,
		startTime,
		verboseInfo,
		options,
		fileDescriptors: handleStdioSync(options, verboseInfo)
	};
};
const normalizeSyncOptions = (options) => options.node && !options.ipc ? {
	...options,
	ipc: false
} : options;
const validateSyncOptions = ({ ipc, ipcInput, detached, cancelSignal, killDescendants }) => {
	if (ipcInput) throwInvalidSyncOption("ipcInput");
	if (ipc) throwInvalidSyncOption("ipc: true");
	if (detached) throwInvalidSyncOption("detached: true");
	if (killDescendants) throwInvalidSyncOption("killDescendants: true");
	if (cancelSignal) throwInvalidSyncOption("cancelSignal");
};
const throwInvalidSyncOption = (value) => {
	throw new TypeError(`The "${value}" option cannot be used with synchronous methods.`);
};
const spawnSubprocessSync = ({ file, commandArguments, options, command, escapedCommand, verboseInfo, fileDescriptors, startTime }) => {
	const syncResult = runSubprocessSync({
		file,
		commandArguments,
		options,
		command,
		escapedCommand,
		fileDescriptors,
		startTime
	});
	if (syncResult.failed) return syncResult;
	const { resultError, exitCode, signal, timedOut, isMaxBuffer } = getExitResultSync(syncResult, options);
	const { output, error = resultError } = transformOutputSync({
		fileDescriptors,
		syncResult,
		options,
		isMaxBuffer,
		verboseInfo
	});
	return getSyncResult({
		error,
		exitCode,
		signal,
		timedOut,
		isMaxBuffer,
		stdio: output.map((stdioOutput, fdNumber) => stripNewline(stdioOutput, options, fdNumber)),
		all: stripNewline(getAllSync(output, options), options, "all"),
		options,
		command,
		escapedCommand,
		startTime
	});
};
const runSubprocessSync = ({ file, commandArguments, options, command, escapedCommand, fileDescriptors, startTime }) => {
	try {
		addInputOptionsSync(fileDescriptors, options);
		return spawnSync(...concatenateShell(file, commandArguments, normalizeSpawnSyncOptions(options)));
	} catch (error) {
		return makeEarlyError({
			error,
			command,
			escapedCommand,
			fileDescriptors,
			options,
			startTime,
			isSync: true
		});
	}
};
const normalizeSpawnSyncOptions = ({ encoding, maxBuffer, ...options }) => ({
	...options,
	encoding: "buffer",
	maxBuffer: getMaxBufferSync(maxBuffer)
});
const getSyncResult = ({ error, exitCode, signal, timedOut, isMaxBuffer, stdio, all, options, command, escapedCommand, startTime }) => error === void 0 ? makeSuccessResult({
	command,
	escapedCommand,
	stdio,
	all,
	ipcOutput: [],
	options,
	startTime
}) : makeError({
	error,
	command,
	escapedCommand,
	timedOut,
	isCanceled: false,
	isGracefullyCanceled: false,
	isMaxBuffer,
	isForcefullyTerminated: false,
	exitCode,
	signal,
	stdio,
	all,
	ipcOutput: [],
	options,
	startTime,
	isSync: true
});

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/ipc/get-one.js
const internalGetOneMessageOptions = Symbol("internalGetOneMessageOptions");
const getOneMessage$1 = ({ anyProcess, channel, isSubprocess, ipc }, options = {}) => {
	const { reference = true, filter } = options;
	const { signal } = options[internalGetOneMessageOptions] ?? {};
	validateIpcMethod({
		methodName: "getOneMessage",
		isSubprocess,
		ipc,
		isConnected: isConnected(anyProcess)
	});
	return getOneMessageAsync({
		anyProcess,
		channel,
		isSubprocess,
		filter,
		reference,
		signal
	});
};
const getOneMessageAsync = async ({ anyProcess, channel, isSubprocess, filter, reference, signal }) => {
	addReference(channel, reference);
	const ipcEmitter = getIpcEmitter(anyProcess, channel, isSubprocess);
	const controller = new AbortController();
	stopOnAbort$1(signal, controller);
	try {
		return await Promise.race([
			getMessage(ipcEmitter, filter, controller),
			throwOnDisconnect(ipcEmitter, isSubprocess, controller),
			throwOnStrictError(ipcEmitter, isSubprocess, controller)
		]);
	} catch (error) {
		disconnect(anyProcess);
		throw error;
	} finally {
		controller.abort();
		removeReference(channel, reference);
	}
};
const stopOnAbort$1 = (signal, controller) => {
	if (signal === void 0) return;
	if (signal.aborted) {
		controller.abort();
		return;
	}
	signal.addEventListener("abort", () => {
		controller.abort();
	}, {
		once: true,
		signal: controller.signal
	});
};
const getMessage = async (ipcEmitter, filter, { signal }) => {
	if (filter === void 0) {
		const [message] = await once(ipcEmitter, "message", { signal });
		return message;
	}
	for await (const [message] of on(ipcEmitter, "message", { signal })) if (filter(message)) return message;
};
const throwOnDisconnect = async (ipcEmitter, isSubprocess, { signal }) => {
	await once(ipcEmitter, "disconnect", { signal });
	throwOnEarlyDisconnect(isSubprocess);
};
const throwOnStrictError = async (ipcEmitter, isSubprocess, { signal }) => {
	const [error] = await once(ipcEmitter, "strict:error", { signal });
	throw getStrictResponseError(error, isSubprocess);
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/ipc/get-each.js
const internalGetEachMessageOptions = Symbol("internalGetEachMessageOptions");
const getEachMessage$1 = (subprocessInfo, options = {}) => {
	const { reference = true } = options;
	const { signal, shouldAwait = !subprocessInfo.isSubprocess } = options[internalGetEachMessageOptions] ?? {};
	return loopOnMessages({
		...subprocessInfo,
		shouldAwait,
		reference,
		signal
	});
};
const loopOnMessages = ({ anyProcess, waitProcess = anyProcess, channel, isSubprocess, ipc, shouldAwait, reference, signal }) => {
	validateIpcMethod({
		methodName: "getEachMessage",
		isSubprocess,
		ipc,
		isConnected: isConnected(anyProcess)
	});
	addReference(channel, reference);
	const ipcEmitter = getIpcEmitter(anyProcess, channel, isSubprocess);
	const controller = new AbortController();
	const state = {};
	stopOnAbort(signal, controller);
	stopOnDisconnect(anyProcess, ipcEmitter, controller);
	abortOnStrictError({
		ipcEmitter,
		isSubprocess,
		controller,
		state
	});
	return iterateOnMessages({
		anyProcess,
		waitProcess,
		channel,
		ipcEmitter,
		isSubprocess,
		shouldAwait,
		controller,
		state,
		reference
	});
};
const stopOnAbort = (signal, controller) => {
	if (signal === void 0) return;
	if (signal.aborted) {
		controller.abort();
		return;
	}
	signal.addEventListener("abort", () => {
		controller.abort();
	}, {
		once: true,
		signal: controller.signal
	});
};
const stopOnDisconnect = async (anyProcess, ipcEmitter, controller) => {
	try {
		await once(ipcEmitter, "disconnect", { signal: controller.signal });
		controller.abort();
	} catch {}
};
const abortOnStrictError = async ({ ipcEmitter, isSubprocess, controller, state }) => {
	try {
		const [error] = await once(ipcEmitter, "strict:error", { signal: controller.signal });
		state.error = getStrictResponseError(error, isSubprocess);
		controller.abort();
	} catch {}
};
const iterateOnMessages = async function* ({ anyProcess, waitProcess, channel, ipcEmitter, isSubprocess, shouldAwait, controller, state, reference }) {
	try {
		for await (const [message] of on(ipcEmitter, "message", { signal: controller.signal })) {
			throwIfStrictError(state);
			yield message;
		}
	} catch {
		throwIfStrictError(state);
	} finally {
		controller.abort();
		removeReference(channel, reference);
		if (!isSubprocess) disconnect(anyProcess);
		if (shouldAwait) await waitProcess;
	}
};
const throwIfStrictError = ({ error }) => {
	if (error) throw error;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/ipc/methods.js
const addIpcMethods = (target, subprocess, { ipc }) => {
	Object.assign(target, getIpcMethods(subprocess, false, ipc, target));
};
const getIpcExport = () => {
	const anyProcess = process$1;
	const isSubprocess = true;
	const isIpc = process$1.channel !== void 0;
	return {
		...getIpcMethods(anyProcess, isSubprocess, isIpc),
		getCancelSignal: getCancelSignal$1.bind(void 0, {
			anyProcess,
			channel: anyProcess.channel,
			isSubprocess,
			ipc: isIpc
		})
	};
};
const getIpcMethods = (anyProcess, isSubprocess, ipc, waitProcess = anyProcess) => ({
	sendMessage: sendMessage$1.bind(void 0, {
		anyProcess,
		channel: anyProcess.channel,
		isSubprocess,
		ipc
	}),
	getOneMessage: getOneMessage$1.bind(void 0, {
		anyProcess,
		channel: anyProcess.channel,
		isSubprocess,
		ipc
	}),
	getEachMessage: getEachMessage$1.bind(void 0, {
		anyProcess,
		channel: anyProcess.channel,
		isSubprocess,
		ipc,
		waitProcess
	})
});

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/return/early-error.js
const handleEarlyError = ({ error, command, escapedCommand, fileDescriptors, options, startTime, verboseInfo }) => {
	cleanupCustomStreams(fileDescriptors);
	const subprocess = new ChildProcess();
	const all = createDummyStreams(subprocess, fileDescriptors);
	return {
		subprocess,
		promise: handleDummyPromise(makeEarlyError({
			error,
			command,
			escapedCommand,
			fileDescriptors,
			options,
			startTime,
			isSync: false
		}), verboseInfo, options),
		all: options.all ? all : void 0,
		convertedStreams: {
			readable,
			writable,
			duplex,
			readableStream,
			writableStream,
			transformStream,
			iterable,
			[Symbol.asyncIterator]: iterable
		}
	};
};
const createDummyStreams = (subprocess, fileDescriptors) => {
	const stdin = createDummyStream();
	const stdout = createDummyStream();
	const stderr = createDummyStream();
	const extraStdio = Array.from({ length: fileDescriptors.length - 3 }, createDummyStream);
	const all = createDummyStream();
	const stdio = [
		stdin,
		stdout,
		stderr,
		...extraStdio
	];
	Object.assign(subprocess, {
		stdin,
		stdout,
		stderr,
		stdio
	});
	return all;
};
const createDummyStream = () => {
	const stream = new PassThrough();
	stream.end();
	return stream;
};
const readable = () => new Readable({ read() {} });
const writable = () => new Writable({ write() {} });
const duplex = () => new Duplex({
	read() {},
	write() {}
});
const readableStream = () => Readable.toWeb(readable());
const writableStream = () => Writable.toWeb(writable());
const transformStream = () => Duplex.toWeb(duplex());
const iterable = async function* () {};
const handleDummyPromise = async (error, verboseInfo, options) => handleResult(error, verboseInfo, options);

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/stdio/handle-async.js
const handleStdioAsync = (options, verboseInfo) => handleStdio(addPropertiesAsync, options, verboseInfo, false);
const forbiddenIfAsync = ({ type, optionName }) => {
	throw new TypeError(`The \`${optionName}\` option cannot be ${TYPE_TO_MESSAGE[type]}.`);
};
const addProperties = {
	fileNumber: forbiddenIfAsync,
	generator: generatorToStream,
	asyncGenerator: generatorToStream,
	nodeStream: ({ value }) => ({ stream: value }),
	webTransform({ value: { transform, writableObjectMode, readableObjectMode } }) {
		const objectMode = writableObjectMode || readableObjectMode;
		return { stream: Duplex.fromWeb(transform, { objectMode }) };
	},
	duplex: ({ value: { transform } }) => ({ stream: transform }),
	native() {}
};
const addPropertiesAsync = {
	input: {
		...addProperties,
		fileUrl: ({ value }) => ({ stream: createReadStream(value) }),
		filePath: ({ value: { file } }) => ({ stream: createReadStream(file) }),
		webStream: ({ value }) => ({ stream: Readable.fromWeb(value) }),
		iterable: ({ value }) => ({ stream: Readable.from(value) }),
		asyncIterable: ({ value }) => ({ stream: Readable.from(value) }),
		string: ({ value }) => ({ stream: Readable.from(value) }),
		uint8Array: ({ value }) => ({ stream: Readable.from(Buffer.from(value)) })
	},
	output: {
		...addProperties,
		fileUrl: ({ value }) => ({ stream: createWriteStream(value) }),
		filePath: ({ value: { file, append } }) => ({ stream: createWriteStream(file, append ? { flags: "a" } : {}) }),
		webStream: ({ value }) => ({ stream: Writable.fromWeb(value) }),
		iterable: forbiddenIfAsync,
		asyncIterable: forbiddenIfAsync,
		string: forbiddenIfAsync,
		uint8Array: forbiddenIfAsync
	}
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/@sindresorhus+merge-streams@4.0.0/node_modules/@sindresorhus/merge-streams/index.js
function mergeStreams(streams) {
	if (!Array.isArray(streams)) throw new TypeError(`Expected an array, got \`${typeof streams}\`.`);
	for (const stream of streams) validateStream(stream);
	const objectMode = streams.some(({ readableObjectMode }) => readableObjectMode);
	const highWaterMark = getHighWaterMark(streams, objectMode);
	const passThroughStream = new MergedStream({
		objectMode,
		writableHighWaterMark: highWaterMark,
		readableHighWaterMark: highWaterMark
	});
	for (const stream of streams) passThroughStream.add(stream);
	return passThroughStream;
}
const getHighWaterMark = (streams, objectMode) => {
	if (streams.length === 0) return getDefaultHighWaterMark(objectMode);
	const highWaterMarks = streams.filter(({ readableObjectMode }) => readableObjectMode === objectMode).map(({ readableHighWaterMark }) => readableHighWaterMark);
	return Math.max(...highWaterMarks);
};
var MergedStream = class extends PassThrough {
	#streams = /* @__PURE__ */ new Set([]);
	#ended = /* @__PURE__ */ new Set([]);
	#aborted = /* @__PURE__ */ new Set([]);
	#onFinished;
	#unpipeEvent = Symbol("unpipe");
	#streamPromises = /* @__PURE__ */ new WeakMap();
	add(stream) {
		validateStream(stream);
		if (this.#streams.has(stream)) return;
		this.#streams.add(stream);
		this.#onFinished ??= onMergedStreamFinished(this, this.#streams, this.#unpipeEvent);
		const streamPromise = endWhenStreamsDone({
			passThroughStream: this,
			stream,
			streams: this.#streams,
			ended: this.#ended,
			aborted: this.#aborted,
			onFinished: this.#onFinished,
			unpipeEvent: this.#unpipeEvent
		});
		this.#streamPromises.set(stream, streamPromise);
		stream.pipe(this, { end: false });
	}
	async remove(stream) {
		validateStream(stream);
		if (!this.#streams.has(stream)) return false;
		const streamPromise = this.#streamPromises.get(stream);
		if (streamPromise === void 0) return false;
		this.#streamPromises.delete(stream);
		stream.unpipe(this);
		await streamPromise;
		return true;
	}
};
const onMergedStreamFinished = async (passThroughStream, streams, unpipeEvent) => {
	updateMaxListeners(passThroughStream, PASSTHROUGH_LISTENERS_COUNT);
	const controller = new AbortController();
	try {
		await Promise.race([onMergedStreamEnd(passThroughStream, controller), onInputStreamsUnpipe(passThroughStream, streams, unpipeEvent, controller)]);
	} finally {
		controller.abort();
		updateMaxListeners(passThroughStream, -PASSTHROUGH_LISTENERS_COUNT);
	}
};
const onMergedStreamEnd = async (passThroughStream, { signal }) => {
	try {
		await finished(passThroughStream, {
			signal,
			cleanup: true
		});
	} catch (error) {
		errorOrAbortStream(passThroughStream, error);
		throw error;
	}
};
const onInputStreamsUnpipe = async (passThroughStream, streams, unpipeEvent, { signal }) => {
	for await (const [unpipedStream] of on(passThroughStream, "unpipe", { signal })) if (streams.has(unpipedStream)) unpipedStream.emit(unpipeEvent);
};
const validateStream = (stream) => {
	if (typeof stream?.pipe !== "function") throw new TypeError(`Expected a readable stream, got: \`${typeof stream}\`.`);
};
const endWhenStreamsDone = async ({ passThroughStream, stream, streams, ended, aborted, onFinished, unpipeEvent }) => {
	updateMaxListeners(passThroughStream, PASSTHROUGH_LISTENERS_PER_STREAM);
	const controller = new AbortController();
	try {
		await Promise.race([
			afterMergedStreamFinished(onFinished, stream, controller),
			onInputStreamEnd({
				passThroughStream,
				stream,
				streams,
				ended,
				aborted,
				controller
			}),
			onInputStreamUnpipe({
				stream,
				streams,
				ended,
				aborted,
				unpipeEvent,
				controller
			})
		]);
	} finally {
		controller.abort();
		updateMaxListeners(passThroughStream, -PASSTHROUGH_LISTENERS_PER_STREAM);
	}
	if (streams.size > 0 && streams.size === ended.size + aborted.size) if (ended.size === 0 && aborted.size > 0) abortStream(passThroughStream);
	else endStream(passThroughStream);
};
const afterMergedStreamFinished = async (onFinished, stream, { signal }) => {
	try {
		await onFinished;
		if (!signal.aborted) abortStream(stream);
	} catch (error) {
		if (!signal.aborted) errorOrAbortStream(stream, error);
	}
};
const onInputStreamEnd = async ({ passThroughStream, stream, streams, ended, aborted, controller: { signal } }) => {
	try {
		await finished(stream, {
			signal,
			cleanup: true,
			readable: true,
			writable: false
		});
		if (streams.has(stream)) ended.add(stream);
	} catch (error) {
		if (signal.aborted || !streams.has(stream)) return;
		if (isAbortError(error)) aborted.add(stream);
		else errorStream(passThroughStream, error);
	}
};
const onInputStreamUnpipe = async ({ stream, streams, ended, aborted, unpipeEvent, controller: { signal } }) => {
	await once(stream, unpipeEvent, { signal });
	if (!stream.readable) return once(signal, "abort", { signal });
	streams.delete(stream);
	ended.delete(stream);
	aborted.delete(stream);
};
const endStream = (stream) => {
	if (stream.writable) stream.end();
};
const errorOrAbortStream = (stream, error) => {
	if (isAbortError(error)) abortStream(stream);
	else errorStream(stream, error);
};
const isAbortError = (error) => error?.code === "ERR_STREAM_PREMATURE_CLOSE";
const abortStream = (stream) => {
	if (stream.readable || stream.writable) stream.destroy();
};
const errorStream = (stream, error) => {
	if (!stream.destroyed) {
		stream.once("error", noop);
		stream.destroy(error);
	}
};
const noop = () => {};
const updateMaxListeners = (passThroughStream, increment) => {
	const maxListeners = passThroughStream.getMaxListeners();
	if (maxListeners !== 0 && maxListeners !== Number.POSITIVE_INFINITY) passThroughStream.setMaxListeners(maxListeners + increment);
};
const PASSTHROUGH_LISTENERS_COUNT = 2;
const PASSTHROUGH_LISTENERS_PER_STREAM = 1;

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/io/pipeline.js
const pipeStreams = (source, destination) => {
	source.pipe(destination);
	onSourceFinish(source, destination);
	onDestinationFinish(source, destination);
};
const onSourceFinish = async (source, destination) => {
	if (isStandardStream(source) || isStandardStream(destination)) return;
	try {
		await finished(source, {
			cleanup: true,
			readable: true,
			writable: false
		});
	} catch {}
	endDestinationStream(destination);
};
const endDestinationStream = (destination) => {
	if (destination.writable) destination.end();
};
const onDestinationFinish = async (source, destination) => {
	if (isStandardStream(source) || isStandardStream(destination)) return;
	try {
		await finished(destination, {
			cleanup: true,
			readable: false,
			writable: true
		});
	} catch {}
	abortSourceStream(source);
};
const abortSourceStream = (source) => {
	if (source.readable) source.destroy();
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/io/output-async.js
const pipeOutputAsync = (subprocess, fileDescriptors, controller) => {
	const pipeGroups = /* @__PURE__ */ new Map();
	for (const [fdNumber, { stdioItems, direction }] of Object.entries(fileDescriptors)) {
		const transformItems = stdioItems.filter(({ type }) => TRANSFORM_TYPES.has(type));
		for (const { stream } of transformItems) pipeTransform(subprocess, stream, direction, fdNumber);
		const nonTransformItems = stdioItems.filter(({ type }) => !TRANSFORM_TYPES.has(type));
		for (const { stream } of nonTransformItems) pipeStdioItem({
			subprocess,
			stream,
			direction,
			fdNumber,
			pipeGroups,
			controller
		});
	}
	for (const [outputStream, inputStreams] of pipeGroups) pipeStreams(inputStreams.length === 1 ? inputStreams[0] : mergeStreams(inputStreams), outputStream);
};
const pipeTransform = (subprocess, stream, direction, fdNumber) => {
	if (direction === "output") pipeStreams(subprocess.stdio[fdNumber], stream);
	else pipeStreams(stream, subprocess.stdio[fdNumber]);
	const streamProperty = SUBPROCESS_STREAM_PROPERTIES[fdNumber];
	if (streamProperty !== void 0) subprocess[streamProperty] = stream;
	subprocess.stdio[fdNumber] = stream;
};
const SUBPROCESS_STREAM_PROPERTIES = [
	"stdin",
	"stdout",
	"stderr"
];
const pipeStdioItem = ({ subprocess, stream, direction, fdNumber, pipeGroups, controller }) => {
	if (stream === void 0) return;
	setStandardStreamMaxListeners(stream, controller);
	const [inputStream, outputStream] = direction === "output" ? [stream, subprocess.stdio[fdNumber]] : [subprocess.stdio[fdNumber], stream];
	const outputStreams = pipeGroups.get(inputStream) ?? [];
	pipeGroups.set(inputStream, [...outputStreams, outputStream]);
};
const setStandardStreamMaxListeners = (stream, { signal }) => {
	if (isStandardStream(stream)) incrementMaxListeners(stream, MAX_LISTENERS_INCREMENT, signal);
};
const MAX_LISTENERS_INCREMENT = 2;

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/terminate/kill-descendants.js
const isWindows = process$1.platform === "win32";
const getSpawnOptions = (options) => options.killDescendants && !isWindows ? {
	...options,
	detached: true
} : options;
const getKillFunction = (subprocess, { killDescendants }) => {
	if (!killDescendants) return subprocess.kill.bind(subprocess);
	return (isWindows ? killDescendantsWindows : killDescendantsUnix).bind(void 0, subprocess);
};
const killDescendantsUnix = (subprocess, signal) => {
	if (subprocess.pid === void 0) return false;
	try {
		return process$1.kill(-subprocess.pid, signal);
	} catch {
		return subprocess.kill(signal);
	}
};
const killDescendantsWindows = (subprocess, signal) => {
	if (subprocess.pid === void 0) return false;
	const taskkillFile = getTaskkillFile();
	if (taskkillFile === void 0) return subprocess.kill(signal);
	execFile(taskkillFile, [
		"/pid",
		`${subprocess.pid}`,
		"/T",
		"/F"
	], (error) => {
		if (error) subprocess.kill(signal);
	});
	return true;
};
const getTaskkillFile = () => {
	const windowsDirectory = [process$1.env.SystemRoot, process$1.env.windir].find((directory) => directory && isWindowsDriveAbsolutePath(directory));
	return windowsDirectory === void 0 ? void 0 : path$1.join(windowsDirectory, "System32", "taskkill.exe");
};
const isWindowsDriveAbsolutePath = (directory) => {
	const { root } = path$1.parse(directory);
	return /^[a-z]:[/\\]/i.test(root);
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/signal-exit@4.1.0/node_modules/signal-exit/dist/mjs/signals.js
/**
* This is not the set of all possible signals.
*
* It IS, however, the set of all signals that trigger
* an exit on either Linux or BSD systems.  Linux is a
* superset of the signal names supported on BSD, and
* the unknown signals just fail to register, so we can
* catch that easily enough.
*
* Windows signals are a different set, since there are
* signals that terminate Windows processes, but don't
* terminate (or don't even exist) on Posix systems.
*
* Don't bother with SIGKILL.  It's uncatchable, which
* means that we can't fire any callbacks anyway.
*
* If a user does happen to register a handler on a non-
* fatal signal like SIGWINCH or something, and then
* exit, it'll end up firing `process.emit('exit')`, so
* the handler will be fired anyway.
*
* SIGBUS, SIGFPE, SIGSEGV and SIGILL, when not raised
* artificially, inherently leave the process in a
* state from which it is not safe to try and enter JS
* listeners.
*/
const signals = [];
signals.push("SIGHUP", "SIGINT", "SIGTERM");
if (process.platform !== "win32") signals.push("SIGALRM", "SIGABRT", "SIGVTALRM", "SIGXCPU", "SIGXFSZ", "SIGUSR2", "SIGTRAP", "SIGSYS", "SIGQUIT", "SIGIOT");
if (process.platform === "linux") signals.push("SIGIO", "SIGPOLL", "SIGPWR", "SIGSTKFLT");

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/signal-exit@4.1.0/node_modules/signal-exit/dist/mjs/index.js
const processOk = (process) => !!process && typeof process === "object" && typeof process.removeListener === "function" && typeof process.emit === "function" && typeof process.reallyExit === "function" && typeof process.listeners === "function" && typeof process.kill === "function" && typeof process.pid === "number" && typeof process.on === "function";
const kExitEmitter = Symbol.for("signal-exit emitter");
const global = globalThis;
const ObjectDefineProperty = Object.defineProperty.bind(Object);
var Emitter = class {
	emitted = {
		afterExit: false,
		exit: false
	};
	listeners = {
		afterExit: [],
		exit: []
	};
	count = 0;
	id = Math.random();
	constructor() {
		if (global[kExitEmitter]) return global[kExitEmitter];
		ObjectDefineProperty(global, kExitEmitter, {
			value: this,
			writable: false,
			enumerable: false,
			configurable: false
		});
	}
	on(ev, fn) {
		this.listeners[ev].push(fn);
	}
	removeListener(ev, fn) {
		const list = this.listeners[ev];
		const i = list.indexOf(fn);
		/* c8 ignore start */
		if (i === -1) return;
		/* c8 ignore stop */
		if (i === 0 && list.length === 1) list.length = 0;
		else list.splice(i, 1);
	}
	emit(ev, code, signal) {
		if (this.emitted[ev]) return false;
		this.emitted[ev] = true;
		let ret = false;
		for (const fn of this.listeners[ev]) ret = fn(code, signal) === true || ret;
		if (ev === "exit") ret = this.emit("afterExit", code, signal) || ret;
		return ret;
	}
};
var SignalExitBase = class {};
const signalExitWrap = (handler) => {
	return {
		onExit(cb, opts) {
			return handler.onExit(cb, opts);
		},
		load() {
			return handler.load();
		},
		unload() {
			return handler.unload();
		}
	};
};
var SignalExitFallback = class extends SignalExitBase {
	onExit() {
		return () => {};
	}
	load() {}
	unload() {}
};
var SignalExit = class extends SignalExitBase {
	/* c8 ignore start */
	#hupSig = process$2.platform === "win32" ? "SIGINT" : "SIGHUP";
	/* c8 ignore stop */
	#emitter = new Emitter();
	#process;
	#originalProcessEmit;
	#originalProcessReallyExit;
	#sigListeners = {};
	#loaded = false;
	constructor(process) {
		super();
		this.#process = process;
		this.#sigListeners = {};
		for (const sig of signals) this.#sigListeners[sig] = () => {
			const listeners = this.#process.listeners(sig);
			let { count } = this.#emitter;
			/* c8 ignore start */
			const p = process;
			if (typeof p.__signal_exit_emitter__ === "object" && typeof p.__signal_exit_emitter__.count === "number") count += p.__signal_exit_emitter__.count;
			/* c8 ignore stop */
			if (listeners.length === count) {
				this.unload();
				const ret = this.#emitter.emit("exit", null, sig);
				/* c8 ignore start */
				const s = sig === "SIGHUP" ? this.#hupSig : sig;
				if (!ret) process.kill(process.pid, s);
			}
		};
		this.#originalProcessReallyExit = process.reallyExit;
		this.#originalProcessEmit = process.emit;
	}
	onExit(cb, opts) {
		/* c8 ignore start */
		if (!processOk(this.#process)) return () => {};
		/* c8 ignore stop */
		if (this.#loaded === false) this.load();
		const ev = opts?.alwaysLast ? "afterExit" : "exit";
		this.#emitter.on(ev, cb);
		return () => {
			this.#emitter.removeListener(ev, cb);
			if (this.#emitter.listeners["exit"].length === 0 && this.#emitter.listeners["afterExit"].length === 0) this.unload();
		};
	}
	load() {
		if (this.#loaded) return;
		this.#loaded = true;
		this.#emitter.count += 1;
		for (const sig of signals) try {
			const fn = this.#sigListeners[sig];
			if (fn) this.#process.on(sig, fn);
		} catch (_) {}
		this.#process.emit = (ev, ...a) => {
			return this.#processEmit(ev, ...a);
		};
		this.#process.reallyExit = (code) => {
			return this.#processReallyExit(code);
		};
	}
	unload() {
		if (!this.#loaded) return;
		this.#loaded = false;
		signals.forEach((sig) => {
			const listener = this.#sigListeners[sig];
			/* c8 ignore start */
			if (!listener) throw new Error("Listener not defined for signal: " + sig);
			/* c8 ignore stop */
			try {
				this.#process.removeListener(sig, listener);
			} catch (_) {}
			/* c8 ignore stop */
		});
		this.#process.emit = this.#originalProcessEmit;
		this.#process.reallyExit = this.#originalProcessReallyExit;
		this.#emitter.count -= 1;
	}
	#processReallyExit(code) {
		/* c8 ignore start */
		if (!processOk(this.#process)) return 0;
		this.#process.exitCode = code || 0;
		/* c8 ignore stop */
		this.#emitter.emit("exit", this.#process.exitCode, null);
		return this.#originalProcessReallyExit.call(this.#process, this.#process.exitCode);
	}
	#processEmit(ev, ...args) {
		const og = this.#originalProcessEmit;
		if (ev === "exit" && processOk(this.#process)) {
			if (typeof args[0] === "number") this.#process.exitCode = args[0];
			/* c8 ignore start */
			const ret = og.call(this.#process, ev, ...args);
			/* c8 ignore start */
			this.#emitter.emit("exit", this.#process.exitCode, null);
			/* c8 ignore stop */
			return ret;
		} else return og.call(this.#process, ev, ...args);
	}
};
const process$2 = globalThis.process;
const { onExit, load, unload } = signalExitWrap(processOk(process$2) ? new SignalExit(process$2) : new SignalExitFallback());

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/terminate/cleanup.js
const cleanupOnExit = (kill, { cleanup, detached }, { signal }) => {
	if (!cleanup || detached) return;
	const removeExitHandler = onExit(() => {
		kill();
	});
	addAbortListener(signal, () => {
		removeExitHandler();
	});
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/convert/concurrent.js
const initializeConcurrentStreams = () => ({
	readableDestroy: /* @__PURE__ */ new WeakMap(),
	writableFinal: /* @__PURE__ */ new WeakMap(),
	writableDestroy: /* @__PURE__ */ new WeakMap()
});
const addConcurrentStream = (concurrentStreams, stream, waitName) => {
	const weakMap = concurrentStreams[waitName];
	if (!weakMap.has(stream)) weakMap.set(stream, []);
	const promises = weakMap.get(stream);
	const promise = createDeferred();
	promises.push(promise);
	return {
		resolve: promise.resolve.bind(promise),
		promises
	};
};
const waitForConcurrentStreams = async ({ resolve, promises }, subprocess) => {
	resolve();
	const [isSubprocessExit] = await Promise.race([Promise.allSettled([true, subprocess]), Promise.all([false, ...promises])]);
	return !isSubprocessExit;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/io/iterate.js
const iterateOnSubprocessStream = ({ subprocessStdout, subprocess, binary, shouldEncode, encoding, preserveNewlines }) => {
	const controller = new AbortController();
	stopReadingOnExit(subprocess, controller);
	return iterateOnStream({
		stream: subprocessStdout,
		controller,
		binary,
		shouldEncode: !subprocessStdout.readableObjectMode && shouldEncode,
		encoding,
		shouldSplit: !subprocessStdout.readableObjectMode,
		preserveNewlines
	});
};
const stopReadingOnExit = async (subprocess, controller) => {
	try {
		await subprocess;
	} catch {} finally {
		controller.abort();
	}
};
const iterateForResult = ({ stream, onStreamEnd, lines, encoding, stripFinalNewline, allMixed }) => {
	const controller = new AbortController();
	stopReadingOnStreamEnd(onStreamEnd, controller, stream);
	const objectMode = stream.readableObjectMode && !allMixed;
	return iterateOnStream({
		stream,
		controller,
		binary: encoding === "buffer",
		shouldEncode: !objectMode,
		encoding,
		shouldSplit: !objectMode && lines,
		preserveNewlines: !stripFinalNewline
	});
};
const stopReadingOnStreamEnd = async (onStreamEnd, controller, stream) => {
	try {
		await onStreamEnd;
	} catch {
		stream.destroy();
	} finally {
		controller.abort();
	}
};
const iterateOnStream = ({ stream, controller, binary, shouldEncode, encoding, shouldSplit, preserveNewlines }) => {
	return iterateOnData({
		onStdoutChunk: on(stream, "data", {
			signal: controller.signal,
			highWaterMark: HIGH_WATER_MARK,
			highWatermark: HIGH_WATER_MARK
		}),
		controller,
		binary,
		shouldEncode,
		encoding,
		shouldSplit,
		preserveNewlines
	});
};
const DEFAULT_OBJECT_HIGH_WATER_MARK = getDefaultHighWaterMark(true);
const HIGH_WATER_MARK = DEFAULT_OBJECT_HIGH_WATER_MARK;
const iterateOnData = async function* ({ onStdoutChunk, controller, binary, shouldEncode, encoding, shouldSplit, preserveNewlines }) {
	const generators = getGenerators({
		binary,
		shouldEncode,
		encoding,
		shouldSplit,
		preserveNewlines
	});
	try {
		for await (const [chunk] of onStdoutChunk) yield* transformChunkSync(chunk, generators, 0);
	} catch (error) {
		if (!controller.signal.aborted) throw error;
	} finally {
		yield* finalChunksSync(generators);
	}
};
const getGenerators = ({ binary, shouldEncode, encoding, shouldSplit, preserveNewlines }) => [getEncodingTransformGenerator(binary, encoding, !shouldEncode), getSplitLinesGenerator(binary, preserveNewlines, !shouldSplit, {})].filter(Boolean);

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/convert/iterable.js
const createIterable = (subprocess, encoding, { from, binary: binaryOption = false, preserveNewlines = false } = {}) => {
	const binary = binaryOption || BINARY_ENCODINGS.has(encoding);
	const subprocessStdout = getFromStream(subprocess, from);
	return iterateOnStdoutData(iterateOnSubprocessStream({
		subprocessStdout,
		subprocess,
		binary,
		shouldEncode: true,
		encoding,
		preserveNewlines
	}), subprocessStdout, subprocess);
};
const iterateOnStdoutData = async function* (onStdoutData, subprocessStdout, subprocess) {
	try {
		yield* onStdoutData;
	} finally {
		if (subprocessStdout.readable) subprocessStdout.destroy();
		await subprocess;
	}
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/resolve/wait-stream.js
const waitForStream = async (stream, fdNumber, streamInfo, { isSameDirection, stopOnExit = false } = {}) => {
	const state = handleStdinDestroy(stream, streamInfo);
	const abortController = new AbortController();
	try {
		await Promise.race([...stopOnExit ? [streamInfo.exitPromise] : [], finished(stream, {
			cleanup: true,
			signal: abortController.signal
		})]);
	} catch (error) {
		if (!state.stdinCleanedUp) handleStreamError(error, fdNumber, streamInfo, isSameDirection);
	} finally {
		abortController.abort();
	}
};
const handleStdinDestroy = (stream, { originalStreams, subprocess }) => {
	const [originalStdin] = originalStreams;
	const state = { stdinCleanedUp: false };
	if (stream === originalStdin) spyOnStdinDestroy(stream, subprocess, state);
	return state;
};
const spyOnStdinDestroy = (subprocessStdin, subprocess, state) => {
	const { _destroy } = subprocessStdin;
	subprocessStdin._destroy = (...destroyArguments) => {
		setStdinCleanedUp(subprocess, state);
		_destroy.call(subprocessStdin, ...destroyArguments);
	};
};
const setStdinCleanedUp = ({ exitCode, signalCode }, state) => {
	if (exitCode !== null || signalCode !== null) state.stdinCleanedUp = true;
};
const handleStreamError = (error, fdNumber, streamInfo, isSameDirection) => {
	if (!shouldIgnoreStreamError(error, fdNumber, streamInfo, isSameDirection)) throw error;
};
const shouldIgnoreStreamError = (error, fdNumber, streamInfo, isSameDirection = true) => {
	if (streamInfo.propagating) return isStreamEpipe(error) || isStreamAbort(error);
	streamInfo.propagating = true;
	return isInputFileDescriptor(streamInfo, fdNumber) === isSameDirection ? isStreamEpipe(error) : isStreamAbort(error);
};
const isInputFileDescriptor = ({ fileDescriptors }, fdNumber) => fdNumber !== "all" && fileDescriptors[fdNumber].direction === "input";
const isStreamAbort = (error) => error?.code === "ERR_STREAM_PREMATURE_CLOSE";
const isStreamEpipe = (error) => error?.code === "EPIPE";

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/convert/shared.js
const safeWaitForSubprocessStdin = async (subprocessStdin) => {
	if (subprocessStdin === void 0) return;
	try {
		await waitForSubprocessStdin(subprocessStdin);
	} catch {}
};
const safeWaitForSubprocessStdout = async (subprocessStdout) => {
	if (subprocessStdout === void 0) return;
	try {
		await waitForSubprocessStdout(subprocessStdout);
	} catch {}
};
const waitForSubprocessStdin = async (subprocessStdin) => {
	await finished(subprocessStdin, {
		cleanup: true,
		readable: false,
		writable: true
	});
};
const waitForSubprocessStdout = async (subprocessStdout) => {
	await finished(subprocessStdout, {
		cleanup: true,
		readable: true,
		writable: false
	});
};
const waitForSubprocess = async (subprocess, error) => {
	await subprocess;
	if (error) throw error;
};
const destroyOtherStream = (stream, isOpen, error) => {
	if (error && !isStreamAbort(error)) stream.destroy(error);
	else if (isOpen) stream.destroy();
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/convert/readable.js
const createReadable = ({ subprocess, concurrentStreams, encoding }, { from, binary: binaryOption = true, preserveNewlines = true } = {}) => {
	const binary = binaryOption || BINARY_ENCODINGS.has(encoding);
	const { subprocessStdout, waitReadableDestroy } = getSubprocessStdout(subprocess, from, concurrentStreams);
	const { readableEncoding, readableObjectMode, readableHighWaterMark } = getReadableOptions(subprocessStdout, binary);
	const { read, onStdoutDataDone } = getReadableMethods({
		subprocessStdout,
		subprocess,
		binary,
		encoding,
		preserveNewlines
	});
	const readable = new Readable({
		read,
		destroy: callbackify(onReadableDestroy.bind(void 0, {
			subprocessStdout,
			subprocess,
			waitReadableDestroy
		})),
		highWaterMark: readableHighWaterMark,
		objectMode: readableObjectMode,
		encoding: readableEncoding
	});
	onStdoutFinished({
		subprocessStdout,
		onStdoutDataDone,
		readable,
		subprocess
	});
	return readable;
};
const getSubprocessStdout = (subprocess, from, concurrentStreams) => {
	const subprocessStdout = getFromStream(subprocess, from);
	return {
		subprocessStdout,
		waitReadableDestroy: addConcurrentStream(concurrentStreams, subprocessStdout, "readableDestroy")
	};
};
const getReadableOptions = ({ readableEncoding, readableObjectMode, readableHighWaterMark }, binary) => binary ? {
	readableEncoding,
	readableObjectMode,
	readableHighWaterMark
} : {
	readableEncoding,
	readableObjectMode: true,
	readableHighWaterMark: DEFAULT_OBJECT_HIGH_WATER_MARK
};
const getReadableMethods = ({ subprocessStdout, subprocess, binary, encoding, preserveNewlines }) => {
	const onStdoutDataDone = createDeferred();
	const onStdoutData = iterateOnSubprocessStream({
		subprocessStdout,
		subprocess,
		binary,
		shouldEncode: !binary,
		encoding,
		preserveNewlines
	});
	return {
		read() {
			onRead(this, onStdoutData, onStdoutDataDone);
		},
		onStdoutDataDone
	};
};
const onRead = async (readable, onStdoutData, onStdoutDataDone) => {
	try {
		const { value, done } = await onStdoutData.next();
		if (done) onStdoutDataDone.resolve();
		else readable.push(value);
	} catch {}
};
const onStdoutFinished = async ({ subprocessStdout, onStdoutDataDone, readable, subprocess, subprocessStdin }) => {
	try {
		await waitForSubprocessStdout(subprocessStdout);
		await subprocess;
		await safeWaitForSubprocessStdin(subprocessStdin);
		await onStdoutDataDone;
		if (readable.readable) readable.push(null);
	} catch (error) {
		await safeWaitForSubprocessStdin(subprocessStdin);
		destroyOtherReadable(readable, await getPrematureCloseError(subprocess, error));
	}
};
const getPrematureCloseError = async (subprocess, error) => {
	if (error.code !== "ERR_STREAM_PREMATURE_CLOSE") return error;
	try {
		await subprocess;
	} catch (subprocessError) {
		return subprocessError;
	}
	return error;
};
const onReadableDestroy = async ({ subprocessStdout, subprocess, waitReadableDestroy }, error) => {
	if (!await waitForConcurrentStreams(waitReadableDestroy, subprocess)) return;
	destroyOtherReadable(subprocessStdout, error);
	await waitForSubprocess(subprocess, error);
};
const destroyOtherReadable = (stream, error) => {
	destroyOtherStream(stream, stream.readable, error);
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/convert/web.js
const createReadableStream = (subprocess, readableOptions) => Readable.toWeb(subprocess.readable(readableOptions));
const createWritableStream = (subprocess, writableOptions) => Writable.toWeb(subprocess.writable(writableOptions));
const createTransformStream = (subprocess, duplexOptions) => Duplex.toWeb(subprocess.duplex(duplexOptions));

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/pipe/pipe-arguments.js
const normalizePipeArguments = ({ source, sourcePromise, boundOptions, createNested }, ...pipeArguments) => {
	const startTime = getStartTime();
	const { destination, destinationStream, destinationError, from, unpipeSignal } = getDestinationStream(boundOptions, createNested, pipeArguments);
	const { sourceStream, sourceError } = getSourceStream(source, from);
	const { options: sourceOptions, fileDescriptors } = SUBPROCESS_OPTIONS.get(source);
	return {
		sourcePromise,
		sourceStream,
		sourceOptions,
		sourceError,
		destination,
		destinationStream,
		destinationError,
		unpipeSignal,
		fileDescriptors,
		startTime
	};
};
const getDestinationStream = (boundOptions, createNested, pipeArguments) => {
	try {
		const { destination, pipeOptions: { from, to, unpipeSignal } = {} } = getDestination(boundOptions, createNested, ...pipeArguments);
		return {
			destination,
			destinationStream: getToStream(destination, to),
			from,
			unpipeSignal
		};
	} catch (error) {
		return { destinationError: error };
	}
};
const getDestination = (boundOptions, createNested, firstArgument, ...pipeArguments) => {
	if (Array.isArray(firstArgument)) return {
		destination: createNested(mapDestinationArguments, boundOptions)(firstArgument, ...pipeArguments),
		pipeOptions: boundOptions
	};
	if (typeof firstArgument === "string" || firstArgument instanceof URL || isDenoExecPath(firstArgument)) {
		if (Object.keys(boundOptions).length > 0) throw new TypeError("Please use .pipe(\"file\", ..., options) or .pipe(execa(\"file\", ..., options)) instead of .pipe(options)(\"file\", ...).");
		const [rawFile, rawArguments, rawOptions] = normalizeParameters(firstArgument, ...pipeArguments);
		return {
			destination: createNested(mapDestinationArguments)(rawFile, rawArguments, rawOptions),
			pipeOptions: rawOptions
		};
	}
	if (SUBPROCESS_OPTIONS.has(firstArgument)) {
		if (Object.keys(boundOptions).length > 0) throw new TypeError("Please use .pipe(options)`command` or .pipe($(options)`command`) instead of .pipe(options)($`command`).");
		return {
			destination: firstArgument,
			pipeOptions: pipeArguments[0]
		};
	}
	throw new TypeError(`The first argument must be a template string, an options object, or an Execa subprocess: ${firstArgument}`);
};
const mapDestinationArguments = ({ options }) => ({ options: {
	...options,
	stdin: "pipe",
	piped: true
} });
const getSourceStream = (source, from) => {
	try {
		return { sourceStream: getFromStream(source, from) };
	} catch (error) {
		return { sourceError: error };
	}
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/pipe/throw.js
const handlePipeArgumentsError = ({ sourceStream, sourceError, destinationStream, destinationError, fileDescriptors, sourceOptions, startTime }) => {
	const error = getPipeArgumentsError({
		sourceStream,
		sourceError,
		destinationStream,
		destinationError
	});
	if (error !== void 0) throw createNonCommandError({
		error,
		fileDescriptors,
		sourceOptions,
		startTime
	});
};
const getPipeArgumentsError = ({ sourceStream, sourceError, destinationStream, destinationError }) => {
	if (sourceError !== void 0 && destinationError !== void 0) return destinationError;
	if (destinationError !== void 0) {
		abortSourceStream(sourceStream);
		return destinationError;
	}
	if (sourceError !== void 0) {
		endDestinationStream(destinationStream);
		return sourceError;
	}
};
const createNonCommandError = ({ error, fileDescriptors, sourceOptions, startTime }) => makeEarlyError({
	error,
	command: PIPE_COMMAND_MESSAGE,
	escapedCommand: PIPE_COMMAND_MESSAGE,
	fileDescriptors,
	options: sourceOptions,
	startTime,
	isSync: false
});
const PIPE_COMMAND_MESSAGE = "source.pipe(destination)";

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/pipe/sequence.js
const waitForBothSubprocesses = async (subprocessPromises) => {
	const [{ status: sourceStatus, reason: sourceReason, value: sourceResult = sourceReason }, { status: destinationStatus, reason: destinationReason, value: destinationResult = destinationReason }] = await subprocessPromises;
	if (!destinationResult.pipedFrom.includes(sourceResult)) destinationResult.pipedFrom.push(sourceResult);
	if (destinationStatus === "rejected") throw destinationResult;
	if (sourceStatus === "rejected") throw sourceResult;
	return destinationResult;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/pipe/streaming.js
const pipeSubprocessStream = (sourceStream, destinationStream, maxListenersController) => {
	const mergedStream = MERGED_STREAMS.has(destinationStream) ? pipeMoreSubprocessStream(sourceStream, destinationStream) : pipeFirstSubprocessStream(sourceStream, destinationStream);
	incrementMaxListeners(sourceStream, SOURCE_LISTENERS_PER_PIPE, maxListenersController.signal);
	incrementMaxListeners(destinationStream, DESTINATION_LISTENERS_PER_PIPE, maxListenersController.signal);
	cleanupMergedStreamsMap(destinationStream);
	return mergedStream;
};
const pipeFirstSubprocessStream = (sourceStream, destinationStream) => {
	const mergedStream = mergeStreams([sourceStream]);
	pipeStreams(mergedStream, destinationStream);
	MERGED_STREAMS.set(destinationStream, mergedStream);
	return mergedStream;
};
const pipeMoreSubprocessStream = (sourceStream, destinationStream) => {
	const mergedStream = MERGED_STREAMS.get(destinationStream);
	mergedStream.add(sourceStream);
	return mergedStream;
};
const cleanupMergedStreamsMap = async (destinationStream) => {
	try {
		await finished(destinationStream, {
			cleanup: true,
			readable: false,
			writable: true
		});
	} catch {}
	MERGED_STREAMS.delete(destinationStream);
};
const MERGED_STREAMS = /* @__PURE__ */ new WeakMap();
const SOURCE_LISTENERS_PER_PIPE = 2;
const DESTINATION_LISTENERS_PER_PIPE = 1;

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/pipe/abort.js
const unpipeOnAbort = (unpipeSignal, unpipeContext) => unpipeSignal === void 0 ? [] : [unpipeOnSignalAbort(unpipeSignal, unpipeContext)];
const unpipeOnSignalAbort = async (unpipeSignal, { sourceStream, mergedStream, fileDescriptors, sourceOptions, startTime }) => {
	await aborted(unpipeSignal, sourceStream);
	await mergedStream.remove(sourceStream);
	throw createNonCommandError({
		error: /* @__PURE__ */ new Error("Pipe canceled by `unpipeSignal` option."),
		fileDescriptors,
		sourceOptions,
		startTime
	});
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/pipe/setup.js
const pipeToSubprocess = (sourceInfo, ...pipeArguments) => {
	if (isPlainObject(pipeArguments[0])) return pipeToSubprocess.bind(void 0, {
		...sourceInfo,
		boundOptions: {
			...sourceInfo.boundOptions,
			...pipeArguments[0]
		}
	});
	const { destination, ...normalizedInfo } = normalizePipeArguments(sourceInfo, ...pipeArguments);
	const pipeFailureController = new AbortController();
	const promise = handlePipePromise({
		...normalizedInfo,
		destination,
		pipeFailureController
	});
	promise.pipe = pipeToSubprocess.bind(void 0, {
		...sourceInfo,
		source: destination,
		sourcePromise: promise,
		boundOptions: {}
	});
	forwardDestinationMethods(promise, destination, pipeFailureController.signal);
	return promise;
};
const forwardDestinationMethods = (promise, destination, pipeFailureSignal) => {
	if (destination === void 0) return;
	forwardReadableMethods(promise, destination);
	forwardIpcMethods(promise, destination, pipeFailureSignal);
};
const forwardReadableMethods = (promise, destination) => {
	const subprocessOptions = SUBPROCESS_OPTIONS.get(destination);
	SUBPROCESS_OPTIONS.set(promise, subprocessOptions);
	promise.stdio = destination.stdio;
	promise.all = destination.all;
	const { options: { encoding } } = subprocessOptions;
	const concurrentStreams = initializeConcurrentStreams();
	promise[Symbol.asyncIterator] = createIterable.bind(void 0, promise, encoding, {});
	promise.iterable = createIterable.bind(void 0, promise, encoding);
	promise.readable = createPipeReadable.bind(void 0, promise, {
		subprocess: promise,
		concurrentStreams,
		encoding
	});
	promise.readableStream = createReadableStream.bind(void 0, promise);
	forwardAll(promise, destination);
};
const forwardAll = (promise, destination) => {
	if (destination.all === void 0) {
		promise.all = void 0;
		return;
	}
	Object.defineProperty(promise, "all", {
		get() {
			setAllProperty(promise, destination.all);
			const all = promise.readable({ from: "all" });
			setAllProperty(promise, all);
			return all;
		},
		enumerable: true,
		configurable: true
	});
};
const setAllProperty = (promise, value) => {
	Object.defineProperty(promise, "all", {
		value,
		writable: true,
		enumerable: true,
		configurable: true
	});
};
const createPipeReadable = (promise, readableOptions, ...arguments_) => {
	const readable = createReadable(readableOptions, ...arguments_);
	destroyOnPipeFailure(promise, readable);
	return readable;
};
const destroyOnPipeFailure = async (promise, readable) => {
	try {
		await promise;
	} catch (error) {
		readable.destroy(error);
	}
};
const forwardIpcMethods = (promise, destination, pipeFailureSignal) => {
	promise.sendMessage = destination.sendMessage;
	promise.getOneMessage = getOnePipeMessage.bind(void 0, destination, pipeFailureSignal);
	promise.getEachMessage = getEachPipeMessage.bind(void 0, promise, destination, pipeFailureSignal);
};
const getOnePipeMessage = (destination, pipeFailureSignal, ...arguments_) => {
	const controller = new AbortController();
	return waitForOnePipeMessage(pipeFailureSignal, destination.getOneMessage(...addPipeOptions(arguments_, controller.signal, internalGetOneMessageOptions)), controller);
};
const waitForOnePipeMessage = async (pipeFailureSignal, messagePromise, controller) => {
	try {
		return await Promise.race([messagePromise, getSignalRejection(pipeFailureSignal, controller.signal)]);
	} finally {
		controller.abort();
	}
};
const getSignalRejection = (signal, listenerSignal) => new Promise((_, reject) => {
	if (signal.aborted) {
		reject(signal.reason);
		return;
	}
	signal.addEventListener("abort", () => {
		reject(signal.reason);
	}, {
		once: true,
		signal: listenerSignal
	});
});
const getEachPipeMessage = (promise, destination, pipeFailureSignal, ...arguments_) => {
	const controller = new AbortController();
	const iterator = destination.getEachMessage(...addPipeOptions(arguments_, controller.signal, internalGetEachMessageOptions));
	abortOnSignal(pipeFailureSignal, controller);
	return iterateOnPipeMessages(promise, iterator, controller);
};
const iterateOnPipeMessages = async function* (promise, iterator, controller) {
	try {
		yield* iterator;
	} finally {
		controller.abort();
		await promise;
	}
};
const addPipeOptions = (arguments_, signal, internalOptionsSymbol) => {
	if (arguments_[0] === null) return arguments_;
	const [options] = arguments_;
	return [{
		...options,
		[internalOptionsSymbol]: {
			signal,
			shouldAwait: false
		}
	}];
};
const abortOnSignal = (signal, controller) => {
	if (signal.aborted) {
		controller.abort();
		return;
	}
	signal.addEventListener("abort", () => {
		controller.abort();
	}, {
		once: true,
		signal: controller.signal
	});
};
const handlePipePromise = async ({ sourcePromise, sourceStream, sourceOptions, sourceError, destination, destinationStream, destinationError, unpipeSignal, fileDescriptors, startTime, pipeFailureController }) => {
	const maxListenersController = new AbortController();
	try {
		const subprocessPromises = getSubprocessPromises(sourcePromise, destination);
		handlePipeArgumentsError({
			sourceStream,
			sourceError,
			destinationStream,
			destinationError,
			fileDescriptors,
			sourceOptions,
			startTime
		});
		const mergedStream = pipeSubprocessStream(sourceStream, destinationStream, maxListenersController);
		return await Promise.race([waitForBothSubprocesses(subprocessPromises), ...unpipeOnAbort(unpipeSignal, {
			sourceStream,
			mergedStream,
			sourceOptions,
			fileDescriptors,
			startTime
		})]);
	} catch (error) {
		pipeFailureController.abort(error);
		throw error;
	} finally {
		maxListenersController.abort();
	}
};
const getSubprocessPromises = (sourcePromise, destination) => Promise.allSettled([sourcePromise, destination]);

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/io/contents.js
const getStreamOutput = async ({ stream, onStreamEnd, fdNumber, encoding, buffer, maxBuffer, lines, allMixed, stripFinalNewline, verboseInfo, streamInfo }) => {
	const logPromise = logOutputAsync({
		stream,
		onStreamEnd,
		fdNumber,
		encoding,
		allMixed,
		verboseInfo,
		streamInfo
	});
	if (!buffer) {
		await Promise.all([resumeStream(stream), logPromise]);
		return;
	}
	const iterable = iterateForResult({
		stream,
		onStreamEnd,
		lines,
		encoding,
		stripFinalNewline: getStripFinalNewline(stripFinalNewline, fdNumber),
		allMixed
	});
	const [output] = await Promise.all([getStreamContents({
		stream,
		iterable,
		fdNumber,
		encoding,
		maxBuffer,
		lines
	}), logPromise]);
	return output;
};
const logOutputAsync = async ({ stream, onStreamEnd, fdNumber, encoding, allMixed, verboseInfo, streamInfo: { fileDescriptors } }) => {
	if (!shouldLogOutput({
		stdioItems: fileDescriptors[fdNumber]?.stdioItems,
		encoding,
		verboseInfo,
		fdNumber
	})) return;
	await logLines(iterateForResult({
		stream,
		onStreamEnd,
		lines: true,
		encoding,
		stripFinalNewline: true,
		allMixed
	}), stream, fdNumber, verboseInfo);
};
const resumeStream = async (stream) => {
	await setImmediate();
	if (stream.readableFlowing === null) stream.resume();
};
const getStreamContents = async ({ stream, stream: { readableObjectMode }, iterable, fdNumber, encoding, maxBuffer, lines }) => {
	try {
		if (readableObjectMode || lines) return await getStreamAsArray(iterable, { maxBuffer });
		if (encoding === "buffer") return new Uint8Array(await getStreamAsArrayBuffer(iterable, { maxBuffer }));
		return await getStreamAsString(iterable, { maxBuffer });
	} catch (error) {
		return handleBufferedData(handleMaxBuffer({
			error,
			stream,
			readableObjectMode,
			lines,
			encoding,
			fdNumber
		}));
	}
};
const getBufferedData = async (streamPromise) => {
	try {
		return await streamPromise;
	} catch (error) {
		return handleBufferedData(error);
	}
};
const handleBufferedData = ({ bufferedData }) => isArrayBuffer(bufferedData) ? new Uint8Array(bufferedData) : bufferedData;

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/resolve/stdio.js
const waitForStdioStreams = ({ subprocess, encoding, buffer, maxBuffer, lines, stripFinalNewline, verboseInfo, streamInfo }) => subprocess.stdio.map((stream, fdNumber) => waitForSubprocessStream({
	stream,
	fdNumber,
	encoding,
	buffer: buffer[fdNumber],
	maxBuffer: maxBuffer[fdNumber],
	lines: lines[fdNumber],
	allMixed: false,
	stripFinalNewline,
	verboseInfo,
	streamInfo
}));
const waitForSubprocessStream = async ({ stream, fdNumber, encoding, buffer, maxBuffer, lines, allMixed, stripFinalNewline, verboseInfo, streamInfo }) => {
	if (!stream) return;
	const onStreamEnd = waitForStream(stream, fdNumber, streamInfo);
	if (isInputFileDescriptor(streamInfo, fdNumber)) {
		await onStreamEnd;
		return;
	}
	const [output] = await Promise.all([getStreamOutput({
		stream,
		onStreamEnd,
		fdNumber,
		encoding,
		buffer,
		maxBuffer,
		lines,
		allMixed,
		stripFinalNewline,
		verboseInfo,
		streamInfo
	}), onStreamEnd]);
	return output;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/resolve/all-async.js
const makeAllStream = ({ stdout, stderr }, { all }) => all && (stdout || stderr) ? mergeStreams([stdout, stderr].filter(Boolean)) : void 0;
const waitForAllStream = ({ subprocess, all, encoding, buffer, maxBuffer, lines, stripFinalNewline, verboseInfo, streamInfo }) => waitForSubprocessStream({
	...getAllStream(subprocess, all, buffer),
	fdNumber: "all",
	encoding,
	maxBuffer: maxBuffer[1] + maxBuffer[2],
	lines: lines[1] || lines[2],
	allMixed: getAllMixed(subprocess, all),
	stripFinalNewline,
	verboseInfo,
	streamInfo
});
const getAllStream = ({ stdout, stderr }, all, [, bufferStdout, bufferStderr]) => {
	const buffer = bufferStdout || bufferStderr;
	if (!buffer) return {
		stream: all,
		buffer
	};
	if (!bufferStdout) return {
		stream: stderr,
		buffer
	};
	if (!bufferStderr) return {
		stream: stdout,
		buffer
	};
	return {
		stream: all,
		buffer
	};
};
const getAllMixed = ({ stdout, stderr }, all) => all && stdout && stderr && stdout.readableObjectMode !== stderr.readableObjectMode;

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/verbose/ipc.js
const shouldLogIpc = (verboseInfo) => isFullVerbose(verboseInfo, "ipc");
const logIpcOutput = (message, verboseInfo) => {
	verboseLog({
		type: "ipc",
		verboseMessage: serializeVerboseMessage(message),
		fdNumber: "ipc",
		verboseInfo
	});
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/ipc/buffer-messages.js
const waitForIpcOutput = async ({ subprocess, buffer: bufferArray, maxBuffer: maxBufferArray, ipc, ipcOutput, verboseInfo }) => {
	if (!ipc) return ipcOutput;
	const isVerbose = shouldLogIpc(verboseInfo);
	const buffer = getFdSpecificValue(bufferArray, "ipc");
	const maxBuffer = getFdSpecificValue(maxBufferArray, "ipc");
	for await (const message of loopOnMessages({
		anyProcess: subprocess,
		channel: subprocess.channel,
		isSubprocess: false,
		ipc,
		shouldAwait: false,
		reference: true
	})) {
		if (buffer) {
			checkIpcMaxBuffer(subprocess, ipcOutput, maxBuffer);
			ipcOutput.push(message);
		}
		if (isVerbose) logIpcOutput(message, verboseInfo);
	}
	return ipcOutput;
};
const getBufferedIpcOutput = async (ipcOutputPromise, ipcOutput) => {
	await Promise.allSettled([ipcOutputPromise]);
	return ipcOutput;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/resolve/wait-subprocess.js
const waitForSubprocessResult = async ({ subprocess, kill, all, options: { encoding, buffer, maxBuffer, lines, timeoutDuration: timeout, cancelSignal, gracefulCancel, forceKillAfterDelay, stripFinalNewline, ipc, ipcInput }, context, verboseInfo, fileDescriptors, originalStreams, onInternalError, controller }) => {
	const exitPromise = waitForExit(subprocess, context);
	const streamInfo = {
		originalStreams,
		fileDescriptors,
		subprocess,
		exitPromise,
		propagating: false
	};
	const stdioPromises = waitForStdioStreams({
		subprocess,
		encoding,
		buffer,
		maxBuffer,
		lines,
		stripFinalNewline,
		verboseInfo,
		streamInfo
	});
	const allPromise = waitForAllStream({
		subprocess,
		all,
		encoding,
		buffer,
		maxBuffer,
		lines,
		stripFinalNewline,
		verboseInfo,
		streamInfo
	});
	const ipcOutput = [];
	const ipcOutputPromise = waitForIpcOutput({
		subprocess,
		buffer,
		maxBuffer,
		ipc,
		ipcOutput,
		verboseInfo
	});
	const originalPromises = waitForOriginalStreams(originalStreams, subprocess, streamInfo);
	const customStreamsEndPromises = waitForCustomStreamsEnd(fileDescriptors, streamInfo);
	try {
		return await Promise.race([
			Promise.all([
				{},
				waitForSuccessfulExit(exitPromise),
				Promise.all(stdioPromises),
				allPromise,
				ipcOutputPromise,
				sendIpcInput(subprocess, ipcInput, ipc),
				...originalPromises,
				...customStreamsEndPromises
			]),
			onInternalError,
			throwOnSubprocessError(subprocess, controller),
			...throwOnTimeout(kill, timeout, context, controller),
			...throwOnCancel({
				kill,
				cancelSignal,
				gracefulCancel,
				context,
				controller
			}),
			...throwOnGracefulCancel({
				subprocess,
				kill,
				cancelSignal,
				gracefulCancel,
				forceKillAfterDelay,
				context,
				controller
			})
		]);
	} catch (error) {
		context.terminationReason ??= "other";
		return Promise.all([
			{ error },
			exitPromise,
			Promise.all(stdioPromises.map((stdioPromise) => getBufferedData(stdioPromise))),
			getBufferedData(allPromise),
			getBufferedIpcOutput(ipcOutputPromise, ipcOutput),
			Promise.allSettled(originalPromises),
			Promise.allSettled(customStreamsEndPromises)
		]);
	}
};
const waitForOriginalStreams = (originalStreams, subprocess, streamInfo) => originalStreams.map((stream, fdNumber) => stream === subprocess.stdio[fdNumber] ? void 0 : waitForStream(stream, fdNumber, streamInfo));
const waitForCustomStreamsEnd = (fileDescriptors, streamInfo) => fileDescriptors.flatMap(({ stdioItems }, fdNumber) => stdioItems.filter(({ value, stream = value }) => isStream(stream, { checkOpen: false }) && !isStandardStream(stream)).map(({ type, value, stream = value }) => waitForStream(stream, fdNumber, streamInfo, {
	isSameDirection: TRANSFORM_TYPES.has(type),
	stopOnExit: type === "native"
})));
const throwOnSubprocessError = async (subprocess, { signal }) => {
	const [error] = await once(subprocess, "error", { signal });
	throw error;
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/convert/writable.js
const createWritable = ({ subprocess, concurrentStreams }, { to } = {}) => {
	const { subprocessStdin, waitWritableFinal, waitWritableDestroy } = getSubprocessStdin(subprocess, to, concurrentStreams);
	const writable = new Writable({
		...getWritableMethods(subprocessStdin, subprocess, waitWritableFinal),
		destroy: callbackify(onWritableDestroy.bind(void 0, {
			subprocessStdin,
			subprocess,
			waitWritableFinal,
			waitWritableDestroy
		})),
		highWaterMark: subprocessStdin.writableHighWaterMark,
		objectMode: subprocessStdin.writableObjectMode
	});
	onStdinFinished(subprocessStdin, writable, void 0, subprocess);
	return writable;
};
const getSubprocessStdin = (subprocess, to, concurrentStreams) => {
	const subprocessStdin = getToStream(subprocess, to);
	return {
		subprocessStdin,
		waitWritableFinal: addConcurrentStream(concurrentStreams, subprocessStdin, "writableFinal"),
		waitWritableDestroy: addConcurrentStream(concurrentStreams, subprocessStdin, "writableDestroy")
	};
};
const getWritableMethods = (subprocessStdin, subprocess, waitWritableFinal) => ({
	write: onWrite.bind(void 0, subprocessStdin),
	final: callbackify(onWritableFinal.bind(void 0, subprocessStdin, subprocess, waitWritableFinal))
});
const onWrite = (subprocessStdin, chunk, encoding, done) => {
	if (subprocessStdin.write(chunk, encoding)) done();
	else subprocessStdin.once("drain", done);
};
const onWritableFinal = async (subprocessStdin, subprocess, waitWritableFinal) => {
	if (!await waitForConcurrentStreams(waitWritableFinal, subprocess)) return;
	if (subprocessStdin.writable) subprocessStdin.end();
	await subprocess;
};
const onStdinFinished = async (subprocessStdin, writable, subprocessStdout, subprocess) => {
	try {
		await waitForSubprocessStdin(subprocessStdin);
		await subprocess;
		if (writable.writable) writable.end();
	} catch (error) {
		await safeWaitForSubprocessStdout(subprocessStdout);
		destroyOtherWritable(writable, await getSubprocessError(subprocess, error));
	}
};
const getSubprocessError = async (subprocess, error) => {
	if (!shouldUseSubprocessError(error)) return error;
	try {
		await subprocess;
	} catch (subprocessError) {
		return subprocessError;
	}
	return error;
};
const shouldUseSubprocessError = (error) => error === void 0 || isStreamAbort(error);
const onWritableDestroy = async ({ subprocessStdin, subprocess, waitWritableFinal, waitWritableDestroy }, error) => {
	await waitForConcurrentStreams(waitWritableFinal, subprocess);
	if (await waitForConcurrentStreams(waitWritableDestroy, subprocess)) {
		destroyOtherWritable(subprocessStdin, error);
		await waitForSubprocess(subprocess, error);
	}
};
const destroyOtherWritable = (stream, error) => {
	destroyOtherStream(stream, stream.writable, error);
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/convert/duplex.js
const createDuplex = ({ subprocess, concurrentStreams, encoding }, { from, to, binary: binaryOption = true, preserveNewlines = true } = {}) => {
	const binary = binaryOption || BINARY_ENCODINGS.has(encoding);
	const { subprocessStdout, waitReadableDestroy } = getSubprocessStdout(subprocess, from, concurrentStreams);
	const { subprocessStdin, waitWritableFinal, waitWritableDestroy } = getSubprocessStdin(subprocess, to, concurrentStreams);
	const { readableEncoding, readableObjectMode, readableHighWaterMark } = getReadableOptions(subprocessStdout, binary);
	const { read, onStdoutDataDone } = getReadableMethods({
		subprocessStdout,
		subprocess,
		binary,
		encoding,
		preserveNewlines
	});
	const duplex = new Duplex({
		read,
		...getWritableMethods(subprocessStdin, subprocess, waitWritableFinal),
		destroy: callbackify(onDuplexDestroy.bind(void 0, {
			subprocessStdout,
			subprocessStdin,
			subprocess,
			waitReadableDestroy,
			waitWritableFinal,
			waitWritableDestroy
		})),
		readableHighWaterMark,
		writableHighWaterMark: subprocessStdin.writableHighWaterMark,
		readableObjectMode,
		writableObjectMode: subprocessStdin.writableObjectMode,
		encoding: readableEncoding
	});
	onStdoutFinished({
		subprocessStdout,
		onStdoutDataDone,
		readable: duplex,
		subprocess,
		subprocessStdin
	});
	onStdinFinished(subprocessStdin, duplex, subprocessStdout, subprocess);
	return duplex;
};
const onDuplexDestroy = async ({ subprocessStdout, subprocessStdin, subprocess, waitReadableDestroy, waitWritableFinal, waitWritableDestroy }, error) => {
	await Promise.all([onReadableDestroy({
		subprocessStdout,
		subprocess,
		waitReadableDestroy
	}, error), onWritableDestroy({
		subprocessStdin,
		subprocess,
		waitWritableFinal,
		waitWritableDestroy
	}, error)]);
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/convert/add.js
const addConvertedStreams = (subprocess, { encoding }) => {
	const concurrentStreams = initializeConcurrentStreams();
	subprocess.readable = createReadable.bind(void 0, {
		subprocess,
		concurrentStreams,
		encoding
	});
	subprocess.writable = createWritable.bind(void 0, {
		subprocess,
		concurrentStreams
	});
	subprocess.duplex = createDuplex.bind(void 0, {
		subprocess,
		concurrentStreams,
		encoding
	});
	subprocess.readableStream = createReadableStream.bind(void 0, subprocess);
	subprocess.writableStream = createWritableStream.bind(void 0, subprocess);
	subprocess.transformStream = createTransformStream.bind(void 0, subprocess);
	subprocess.iterable = createIterable.bind(void 0, subprocess, encoding);
	subprocess[Symbol.asyncIterator] = createIterable.bind(void 0, subprocess, encoding, {});
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/methods/promise.js
const mergePromise = (promise, properties) => Object.assign(promise, properties);

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/methods/main-async.js
const execaCoreAsync = (rawFile, rawArguments, rawOptions, createNested) => {
	const { file, commandArguments, command, escapedCommand, startTime, verboseInfo, options, fileDescriptors } = handleAsyncArguments(rawFile, rawArguments, rawOptions);
	const { subprocess: nodeChildProcess, promise, kill, all, convertedStreams } = spawnSubprocessAsync({
		file,
		commandArguments,
		options,
		startTime,
		verboseInfo,
		command,
		escapedCommand,
		fileDescriptors
	});
	const subprocess = getSubprocessPromise({
		promise,
		nodeChildProcess,
		kill,
		all,
		convertedStreams,
		options
	});
	subprocess.pipe = pipeToSubprocess.bind(void 0, {
		source: subprocess,
		sourcePromise: promise,
		boundOptions: {},
		createNested
	});
	SUBPROCESS_OPTIONS.set(subprocess, {
		options,
		fileDescriptors
	});
	return subprocess;
};
const handleAsyncArguments = (rawFile, rawArguments, rawOptions) => {
	const { command, escapedCommand, startTime, verboseInfo } = handleCommand(rawFile, rawArguments, rawOptions);
	const { file, commandArguments, options: normalizedOptions } = normalizeOptions(rawFile, rawArguments, rawOptions);
	const options = handleAsyncOptions(normalizedOptions);
	return {
		file,
		commandArguments,
		command,
		escapedCommand,
		startTime,
		verboseInfo,
		options,
		fileDescriptors: handleStdioAsync(options, verboseInfo)
	};
};
const handleAsyncOptions = ({ timeout, signal, ...options }) => {
	if (signal !== void 0) throw new TypeError("The \"signal\" option has been renamed to \"cancelSignal\" instead.");
	return {
		...options,
		timeoutDuration: timeout
	};
};
const spawnSubprocessAsync = ({ file, commandArguments, options, startTime, verboseInfo, command, escapedCommand, fileDescriptors }) => {
	let subprocess;
	try {
		subprocess = spawn(...concatenateShell(file, commandArguments, getSpawnOptions(options)));
	} catch (error) {
		return handleEarlyError({
			error,
			command,
			escapedCommand,
			fileDescriptors,
			options,
			startTime,
			verboseInfo
		});
	}
	const controller = new AbortController();
	setMaxListeners(Infinity, controller.signal);
	const originalStreams = [...subprocess.stdio];
	pipeOutputAsync(subprocess, fileDescriptors, controller);
	setIpcSubprocessOptions(subprocess, options);
	const context = {};
	const onInternalError = createDeferred();
	const kill = subprocessKill.bind(void 0, {
		kill: getKillFunction(subprocess, options),
		options,
		onInternalError,
		context,
		controller
	});
	cleanupOnExit(kill, options, controller);
	const all = makeAllStream(subprocess, options);
	const promise = handlePromise({
		subprocess,
		kill,
		all,
		options,
		startTime,
		verboseInfo,
		fileDescriptors,
		originalStreams,
		command,
		escapedCommand,
		context,
		onInternalError,
		controller
	});
	return {
		subprocess,
		promise,
		kill,
		all
	};
};
const getSubprocessPromise = ({ promise, nodeChildProcess, kill, all, convertedStreams, options }) => {
	const subprocess = mergePromise(promise, getSubprocessProperties(nodeChildProcess, all));
	subprocess.kill = kill ?? subprocess.kill;
	if (convertedStreams === void 0) addConvertedStreams(subprocess, options);
	else Object.assign(subprocess, convertedStreams);
	addIpcMethods(subprocess, nodeChildProcess, options);
	return subprocess;
};
const getSubprocessProperties = (nodeChildProcess, all) => ({
	nodeChildProcess,
	pid: nodeChildProcess.pid,
	stdin: nodeChildProcess.stdin,
	stdout: nodeChildProcess.stdout,
	stderr: nodeChildProcess.stderr,
	stdio: nodeChildProcess.stdio,
	all,
	kill: nodeChildProcess.kill.bind(nodeChildProcess)
});
const handlePromise = async ({ subprocess, kill, all: allStream, options, startTime, verboseInfo, fileDescriptors, originalStreams, command, escapedCommand, context, onInternalError, controller }) => {
	const [errorInfo, [exitCode, signal], stdioResults, allResult, ipcOutput] = await waitForSubprocessResult({
		subprocess,
		kill,
		all: allStream,
		options,
		context,
		verboseInfo,
		fileDescriptors,
		originalStreams,
		onInternalError,
		controller
	});
	controller.abort();
	onInternalError.resolve();
	return handleResult(getAsyncResult({
		errorInfo,
		exitCode,
		signal,
		stdio: stdioResults.map((stdioResult, fdNumber) => stripNewline(stdioResult, options, fdNumber)),
		all: stripNewline(allResult, options, "all"),
		ipcOutput,
		context,
		options,
		command,
		escapedCommand,
		startTime
	}), verboseInfo, options);
};
const getAsyncResult = ({ errorInfo, exitCode, signal, stdio, all, ipcOutput, context, options, command, escapedCommand, startTime }) => "error" in errorInfo ? makeError({
	error: errorInfo.error,
	command,
	escapedCommand,
	timedOut: context.terminationReason === "timeout",
	isCanceled: context.terminationReason === "cancel" || context.terminationReason === "gracefulCancel",
	isGracefullyCanceled: context.terminationReason === "gracefulCancel",
	isMaxBuffer: errorInfo.error instanceof MaxBufferError,
	isForcefullyTerminated: context.isForcefullyTerminated,
	exitCode,
	signal,
	stdio,
	all,
	ipcOutput,
	options,
	startTime,
	isSync: false
}) : makeSuccessResult({
	command,
	escapedCommand,
	stdio,
	all,
	ipcOutput,
	options,
	startTime
});

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/methods/bind.js
const mergeOptions = (boundOptions, options) => {
	const safeBoundOptions = {
		__proto__: null,
		...boundOptions
	};
	const mergedOptions = Object.fromEntries(Object.entries(options).map(([optionName, optionValue]) => [optionName, mergeOption(optionName, safeBoundOptions[optionName], optionValue)]));
	return {
		...safeBoundOptions,
		...mergedOptions
	};
};
const mergeOption = (optionName, boundOptionValue, optionValue) => {
	if (DEEP_OPTIONS.has(optionName) && isPlainObject(boundOptionValue) && isPlainObject(optionValue)) return {
		...boundOptionValue,
		...optionValue
	};
	return optionValue;
};
const DEEP_OPTIONS = new Set(["env", ...FD_SPECIFIC_OPTIONS]);

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/methods/create.js
const createExeca = (mapArguments, boundOptions, deepOptions, setBoundExeca) => {
	const createNested = (mapArguments, boundOptions, setBoundExeca) => createExeca(mapArguments, boundOptions, deepOptions, setBoundExeca);
	const boundExeca = (...execaArguments) => callBoundExeca({
		mapArguments,
		deepOptions,
		boundOptions,
		setBoundExeca,
		createNested
	}, ...execaArguments);
	if (setBoundExeca !== void 0) setBoundExeca(boundExeca, createNested, boundOptions);
	return boundExeca;
};
const callBoundExeca = ({ mapArguments, deepOptions = {}, boundOptions = {}, setBoundExeca, createNested }, firstArgument, ...nextArguments) => {
	if (isPlainObject(firstArgument)) return createNested(mapArguments, mergeOptions(boundOptions, firstArgument), setBoundExeca);
	const { file, commandArguments, options, isSync } = parseArguments({
		mapArguments,
		firstArgument,
		nextArguments,
		deepOptions,
		boundOptions
	});
	return isSync ? execaCoreSync(file, commandArguments, options) : execaCoreAsync(file, commandArguments, options, createNested);
};
const parseArguments = ({ mapArguments, firstArgument, nextArguments, deepOptions, boundOptions }) => {
	const [initialFile, initialArguments, initialOptions] = normalizeParameters(...isTemplateString(firstArgument) ? parseTemplates(firstArgument, nextArguments) : [firstArgument, ...nextArguments]);
	const mergedOptions = mergeOptions(mergeOptions(deepOptions, boundOptions), initialOptions);
	const { options = mergedOptions, isSync = false } = mapArguments({ options: mergedOptions });
	return {
		file: initialFile,
		commandArguments: initialArguments,
		options,
		isSync
	};
};

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/lib/methods/script.js
const setScriptSync = (boundExeca, createNested, boundOptions) => {
	boundExeca.sync = createNested(mapScriptSync, boundOptions);
	boundExeca.s = boundExeca.sync;
};
const mapScriptAsync = ({ options }) => getScriptOptions(options);
const mapScriptSync = ({ options }) => ({
	...getScriptOptions(options),
	isSync: true
});
const getScriptOptions = (options) => ({ options: {
	...getScriptStdinOption(options),
	...options
} });
const getScriptStdinOption = ({ input, inputFile, stdio }) => input === void 0 && inputFile === void 0 && stdio === void 0 ? { stdin: "inherit" } : {};
const deepScriptOptions = { preferLocal: true };

//#endregion
//#region ../../../../../../../AAA-workboard/DSH/deepseek-harness-source/node_modules/.pnpm/execa@10.0.0/node_modules/execa/index.js
const execa = createExeca(() => ({}));
const execaSync = createExeca(() => ({ isSync: true }));
const execaNode = createExeca(mapNode);
const $ = createExeca(mapScriptAsync, {}, deepScriptOptions, setScriptSync);
const { sendMessage, getOneMessage, getEachMessage, getCancelSignal } = getIpcExport();

//#endregion
export { execa };