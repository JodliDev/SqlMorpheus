export type LoggerMode = "silent" | "error" | "warn" | "log" | "debug";


/**
 * A simple LoggerClass which provides functionality for logging messages
 * in different modes such as normal, debug, silent, and noLog.
 * It allows controlling the verbosity of logs based on the mode.
 */
class LoggerClass {
	mode: LoggerMode = "log";
	
	setMode(mode?: LoggerMode) {
		this.mode = mode ?? "log";
	}
	
	debug(text: string) {
		if(this.mode == "debug") {
			console.debug(`\x1b[90m${(new Date()).toLocaleTimeString()}\x1b[0m ${text}`);
		}
	}
	log(text: string) {
		if(this.mode == "log" || this.mode == "debug") {
			console.log(`\x1b[90m${(new Date()).toLocaleTimeString()}\x1b[0m ${text}`);
		}
	}
	warn(text: string) {
		if(this.mode == "warn" || this.mode == "log" || this.mode == "debug") {
			console.warn(`\x1b[90m${(new Date()).toLocaleTimeString()}\x1b[0m ${text}`);
		}
	}
	error(text: string) {
		if(this.mode == "error" || this.mode == "warn" || this.mode == "log" || this.mode == "debug") {
			console.error(`\x1b[90m${(new Date()).toLocaleTimeString()}\x1b[0m ${text}`);
		}
	}
}

export const Logger = new LoggerClass();