```typescript
// Create the original structure
await runMigration(access, {
	dialect: "Sqlite",
	tables: [
		TableObj.create("OriginalTable", {
			id: [0, {primaryKey: true}],
			originalColumn: ""
		}).sealType()
	],
	version: 1
});

// Insert test data
await access.runTransaction(`
            INSERT INTO OriginalTable (originalColumn) VALUES
            ('value1'),
            ('value2')
        `);

// Check original data:
expect(await access.runReadStatement("SELECT * FROM originalTable")).toEqual([
	{id: 1, originalColumn: "value1"},
	{id: 2, originalColumn: "value2"}
]);


// Rename a table (Table -> RenamedTable) and a column (column -> RenamedColumn):
await runMigration(access, {
	dialect: "Sqlite",
	tables: [
		TableObj.create("RenamedTable", {
			id: [0, {primaryKey: true}],
			renamedColumn: ""
		}).sealType()
	],
	version: 2,
	preMigration: (migrations: PublicMigrations) => {
		migrations.renameTable(2, "OriginalTable", "RenamedTable");
		migrations.renameColumn(2, "RenamedTable", "originalColumn", "renamedColumn");
	}
});


//Check for changed structure:
expect(await access.runReadStatement("SELECT * FROM renamedTable")).toEqual([
	{id: 1, renamedColumn: "value1"},
	{id: 2, renamedColumn: "value2"}
]);
```