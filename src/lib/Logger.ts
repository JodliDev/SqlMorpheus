export type LoggerMode = "silent" | "noLog" | "normal" | "debug";


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