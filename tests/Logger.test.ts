import {beforeEach, describe, expect, it, vi} from "vitest";
import {Logger} from "../src/lib/Logger";

describe("Logger", () => {
	beforeEach(() => {
		Logger.setMode("log");
	});
	
	it("should log debug messages only in 'debug' mode", () => {
		const consoleSpy = vi.spyOn(console, "debug");
		
		Logger.debug("This will not be logged");
		expect(consoleSpy).toHaveBeenCalledTimes(0);
		
		Logger.setMode("debug");
		Logger.debug("Debug message");
		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Debug message"));
		expect(consoleSpy).toHaveBeenCalledTimes(1);
		
		consoleSpy.mockRestore();
	});
	
	it("should not log messages if the mode is 'silent'", () => {
		const consoleSpy = vi.spyOn(console, "log");
		
		Logger.log("This should be logged");
		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("This should be logged"));
		expect(consoleSpy).toHaveBeenCalledTimes(1);
		
		Logger.setMode("silent");
		Logger.log("This should not be logged");
		expect(consoleSpy).toHaveBeenCalledTimes(1);
		
		consoleSpy.mockRestore();
	});
	
	it("should log messages in 'normal' or 'debug' mode", () => {
		const consoleSpy = vi.spyOn(console, "log");
		
		Logger.log("This should be logged");
		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("This should be logged"));
		expect(consoleSpy).toHaveBeenCalledTimes(1);
		
		Logger.setMode("debug");
		Logger.log("Debug log message");
		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Debug log message"));
		
		consoleSpy.mockRestore();
	});
	
	it("should log warnings unless in 'silent' mode", () => {
		const consoleSpy = vi.spyOn(console, "warn");
		
		Logger.setMode("log");
		Logger.warn("Warning message");
		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Warning message"));
		
		Logger.setMode("debug");
		Logger.warn("Warning in debug mode");
		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Warning in debug mode"));
		
		Logger.setMode("silent");
		Logger.warn("This will not be logged");
		expect(consoleSpy).not.toHaveBeenCalledTimes(3);
		
		consoleSpy.mockRestore();
	});
});