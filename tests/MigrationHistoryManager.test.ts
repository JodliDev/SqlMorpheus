import {beforeEach, describe, expect, it, vi} from "vitest";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "fs";
import MigrationHistoryManager from "../src/lib/MigrationHistoryManager";
import {SqlChanges} from "../src";

// Mock fs operations
vi.mock("fs", () => ({
	mkdirSync: vi.fn(),
	writeFileSync: vi.fn(),
	readFileSync: vi.fn(),
	existsSync: vi.fn()
}));

const FILENAME_UP_PREFIX = "up_to_";
const FILENAME_DOWN_PREFIX = "down_to_";

describe("MigrationHistoryManager", () => {
	const mockConfigPath = "/config";
	const mockMigrationsPath = `${mockConfigPath}/migrations`;
	let migrationManager: MigrationHistoryManager;
	
	beforeEach(() => {
		vi.clearAllMocks();
		migrationManager = new MigrationHistoryManager(mockConfigPath);
	});
	
	it("should initialize config and migrations directories", () => {
		expect(mkdirSync).toHaveBeenCalledWith(mockConfigPath, {recursive: true});
		expect(mkdirSync).toHaveBeenCalledWith(mockMigrationsPath, {recursive: true});
	});
	
	describe("createMigrationHistory()", () => {
		const sqlChanges: SqlChanges = {up: "CREATE TABLE test;", down: "DROP TABLE test;"};
		
		it("should create up and down migration files", () => {
			vi.mocked(existsSync).mockReturnValue(false);
			
			migrationManager.createMigrationHistory(0, 2, sqlChanges);
			
			expect(writeFileSync).toHaveBeenCalledWith(
				`${mockMigrationsPath}/${FILENAME_UP_PREFIX}2.sql`,
				'-- From: Version 0\n-- To:   Version 2\nCREATE TABLE test;',
				{encoding: "utf-8"}
			);
			expect(writeFileSync).toHaveBeenCalledWith(
				`${mockMigrationsPath}/${FILENAME_DOWN_PREFIX}0.sql`,
				"-- From: Version 2\n-- To:   Version 0\nDROP TABLE test;",
				{encoding: "utf-8"}
			);
		});
		
		it("should throw an error if migration files already exist and overwrite is false", () => {
			vi.mocked(existsSync).mockReturnValue(true);
			
			expect(() => migrationManager.createMigrationHistory(0, 2, sqlChanges)).toThrow(
				`Migration ${mockMigrationsPath}/${FILENAME_UP_PREFIX}2.sql already exists!`
			);
		});
		
		it("should overwrite migration files if overwriteExisting is true", () => {
			vi.mocked(existsSync).mockReturnValue(true);
			
			expect(() =>
				migrationManager.createMigrationHistory(0, 2, sqlChanges, true)
			).not.toThrow();
			
			expect(writeFileSync).toHaveBeenCalledTimes(2);
		});
	});
	
	describe("getUpMigration()", () => {
		it("should read the up migration file for a specific version", () => {
			vi.mocked(readFileSync).mockReturnValue("-- Mock Up Migration");
			expect(migrationManager.getUpMigration(5)).toBe("-- Mock Up Migration");
			expect(readFileSync).toHaveBeenCalledWith(
				`${mockMigrationsPath}/${FILENAME_UP_PREFIX}5.sql`,
				{encoding: "utf-8"}
			);
		});
	});
	
	describe("getDownMigration()", () => {
		it("should read the down migration file for a specific version", () => {
			vi.mocked(readFileSync).mockReturnValue("-- Mock Down Migration");
			expect(migrationManager.getDownMigration(3)).toBe("-- Mock Down Migration");
			expect(readFileSync).toHaveBeenCalledWith(
				`${mockMigrationsPath}/${FILENAME_DOWN_PREFIX}3.sql`,
				{encoding: "utf-8"}
			);
		});
	});
});