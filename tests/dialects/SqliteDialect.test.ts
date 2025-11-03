import {describe, expect, it, vi} from "vitest";
import SqliteDialect from "../../src/lib/dialects/SqliteDialect";
import {DatabaseAccess} from "../../src";

describe("SqliteDialect", () => {
	const mockAccess = {
		runReadStatement: vi.fn(),
		runWriteStatement: vi.fn(),
		runTransaction: vi.fn(),
	} satisfies DatabaseAccess;
	
	const mockDialect = new SqliteDialect(mockAccess);
	
	it("changeForeignKeysState", () => {
		expect(mockDialect.changeForeignKeysState(true)).toBe("PRAGMA foreign_keys = ON;");
		expect(mockDialect.changeForeignKeysState(false)).toBe("PRAGMA foreign_keys = OFF;");
	});
	
	describe("formatValueToSql", () => {
		it("should format date values correctly", () => {
			const result = mockDialect.formatValueToSql(new Date("2025-07-20"), "date");
			expect(result).toBe(new Date("2025-07-20").getTime().toString());
		});
		
		it("should format datetime values correctly", () => {
			const result = mockDialect.formatValueToSql(new Date("2025-07-20T15:30:00"), "dateTime");
			expect(result).toBe(new Date("2025-07-20T15:30:00").getTime().toString());
		});
		
		it("should format time values correctly", () => {
			const result = mockDialect.formatValueToSql(new Date("2025-07-20T15:30:00"), "time");
			expect(result).toBe(new Date("2025-07-20T15:30:00").getTime().toString());
		});
		
		it("should format true boolean values correctly", () => {
			const result = mockDialect.formatValueToSql(true, "boolean");
			expect(result).toBe("1");
		});
		
		it("should format false boolean values correctly", () => {
			const result = mockDialect.formatValueToSql(false, "boolean");
			expect(result).toBe("0");
		});
	});
});