import {Class, BackendTable} from "./BackendTable";
import AllowedMigrations from "./AllowedMigrations";
import MigrationInstructions from "./MigrationInstructions";
import MigrationNotAllowedException from "../exceptions/NotAllowedException";

export class Migrations {
	private readonly migrationData: Record<string, MigrationInstructions> = {};
	private alwaysAllowed: AllowedMigrations = {};
	
	private getEntry(table: string | Class<BackendTable>): MigrationInstructions {
		const tableName = this.getTableName(table);
		if(!this.migrationData.hasOwnProperty(tableName)) {
			this.migrationData[tableName] = {
				recreate: false,
				renamedColumns: [],
				allowedMigrations: {}
			};
		}
		return this.migrationData[tableName]
	}
	private getTableName(table: string | Class<BackendTable>): string {
		return typeof table == "string" ? table : table.name;
	}
	
	alwaysAllow(... allowedMigrations: (keyof AllowedMigrations)[]) {
		for(const key of allowedMigrations) {
			this.alwaysAllowed[key] = true;
		}
	}
	public allowMigration(version: number, table: string | Class<BackendTable>, ... allowedMigrations: (keyof AllowedMigrations)[]): void {
		const entry = this.getEntry(table);
		
		if(!entry.allowedMigrations.hasOwnProperty(version))
			entry.allowedMigrations[version] = {};
		
		for(const key of allowedMigrations) {
			this.alwaysAllowed[key] = true;
		}
	}
	
	public throwIfNotAllowed(version: number, tableName: string, type: keyof AllowedMigrations): void {
		if(!(this.migrationData[tableName]?.allowedMigrations[version] ?? this.alwaysAllowed)[type])
			throw new MigrationNotAllowedException(version, tableName, type);
	}
	
	public renameTable(oldTableName: string, newTable: string | Class<BackendTable>) {
		const entry = this.getEntry(newTable);
		entry.recreate = true;
		if(!entry.oldTableName) //entry might have already existed
			entry.oldTableName = oldTableName;
	}
	
	public renameColumn(table: string | Class<BackendTable>, oldColumn: string, newColumn: string): void {
		const entry = this.getEntry(table);
		const existingColumnEntry = entry.renamedColumns.find((entry) => entry[entry.length - 1] == oldColumn);
		
		if(existingColumnEntry)
			existingColumnEntry.push(newColumn);
		else
			entry.renamedColumns.push([oldColumn, newColumn]);
	}
	
	public recreateTable(table: Class<BackendTable> | string) {
		const entry = this.getEntry(table);
		entry.recreate = true;
	}
	
	public getMigrationData(): Record<string, MigrationInstructions> {
		return this.migrationData;
	}
	
	public loopRenamedColumns(tableName: string, callback: (oldColumnName: string, newColumnName: string) => void): void {
		const migrationEntry = this.migrationData[tableName];
		
		//We have to assume that there were multiple version changes in which the column name was changed multiple times.
		//So we only rename from the original name (index 0) to the newest (last index)
		for(const renamingArray of migrationEntry.renamedColumns) {
			if(renamingArray.length <= 1)
				continue;
			const oldColumnName = renamingArray[0];
			const newColumnName = renamingArray[renamingArray.length - 1];
			
			callback(oldColumnName, newColumnName);
		}
	}
	
	public getUpdatedColumnName(tableName: string, oldColumnName: string): string {
		const columnNames = this.migrationData[tableName].renamedColumns.find((columns) => columns[0] == oldColumnName);
		return columnNames ? columnNames[columnNames.length - 1] : oldColumnName;
	}
	
	public willBeRecreated(tableName: string): boolean {
		return this.migrationData[tableName]?.recreate;
	}
}

export type PublicMigrations = Pick<Migrations, "recreateTable" | "renameTable" | "renameColumn" | "allowMigration" | "alwaysAllow">;