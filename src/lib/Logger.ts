export type LoggerMode = "silent" | "noLog" | "normal" | "debug";


/**
 * A simple LoggerClass which provides functionality for logging messages
 * in different modes such as normal, debug, silent, and noLog.
 * It allows controlling the verbosity of logs based on the mode.
 */
class LoggerClass {
	mode: LoggerMode = "normal";
	
	setMode(mode?: LoggerMode) {
		this.mode = mode ?? "normal";
	}
	
	debug(text: string) {
		if(this.mode == "debug")
			console.log(text);
	}
	log(text: string) {
		if(this.mode == "silent" || this.mode == "noLog")
			return;
		console.log(text);
	}
	warn(text: string) {
		if(this.mode == "silent")
			return;
		console.warn(text);
	}
}

export const Logger = new LoggerClass();