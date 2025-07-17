import {beforeEach, describe, expect, it, vi} from "vitest";
import {Logger} from "../src/lib/Logger";

describe("Logger", () => {
	beforeEach(() => {
		Logger.setMode("normal");
	})
	it("should set mode correctly using setMode", () => {
		Logger.setMode("debug");
		expect(Logger.mode).toBe("debug");
	});
	
	it("should log debug messages only in 'debug' mode", () => {
		const consoleSpy = vi.spyOn(console, "log");
		
		Logger.setMode("debug");
		Logger.debug("Debug message");
		expect(consoleSpy).toHaveBeenCalledWith("Debug message");
		
		Logger.setMode("normal");
		Logger.debug("This will not be logged");
		expect(consoleSpy).toHaveBeenCalledTimes(1);
		
		consoleSpy.mockRestore();
	});
	
	it("should not log messages if the mode is 'silent' or 'noLog'", () => {
		const consoleSpy = vi.spyOn(console, "log");
		
		Logger.setMode("silent");
		Logger.log("This should not be logged");
		expect(consoleSpy).not.toHaveBeenCalled();
		
		Logger.setMode("noLog");
		Logger.log("This should also not be logged");
		expect(consoleSpy).not.toHaveBeenCalled();
		
		consoleSpy.mockRestore();
	});
	
	it("should log messages in 'normal' or 'debug' mode", () => {
		const consoleSpy = vi.spyOn(console, "log");
		
		Logger.setMode("normal");
		Logger.log("Normal log message");
		expect(consoleSpy).toHaveBeenCalledWith("Normal log message");
		
		Logger.setMode("debug");
		Logger.log("Debug log message");
		expect(consoleSpy).toHaveBeenCalledWith("Debug log message");
		
		consoleSpy.mockRestore();
	});
	
	it("should log warnings unless in 'silent' mode", () => {
		const consoleSpy = vi.spyOn(console, "warn");
		
		Logger.setMode("normal");
		Logger.warn("Warning message");
		expect(consoleSpy).toHaveBeenCalledWith("Warning message");
		
		Logger.setMode("debug");
		Logger.warn("Warning in debug mode");
		expect(consoleSpy).toHaveBeenCalledWith("Warning in debug mode");
		
		Logger.setMode("silent");
		Logger.warn("This will not be logged");
		expect(consoleSpy).not.toHaveBeenCalledTimes(3);
		
		consoleSpy.mockRestore();
	});
});