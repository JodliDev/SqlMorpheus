import {Class, BackendTable} from "./BackendTable";
import AllowedMigrations from "./AllowedMigrations";
import MigrationInstructions from "./MigrationInstructions";
import MigrationNotAllowedException from "../exceptions/NotAllowedException";
import DatabaseInstructions from "./DatabaseInstructions";
import {TableStructure} from "./TableStructure";

export type NotAllowedChangeEntry = {version: number, tableName: string, type: keyof AllowedMigrations};

export class Migrations {
	private toVersion: number = 0;
	private alwaysAllowed: AllowedMigrations = {};
	private fromVersion: number = 0;
	private migrationData: Record<string, MigrationInstructions> = {};
	private notAllowedChanges: NotAllowedChangeEntry[] = [];
	
	
	public reset(dbInstructions: DatabaseInstructions, fromVersion: number) {
		this.fromVersion = fromVersion;
		this.migrationData = {};
		this.toVersion = dbInstructions.version;
		this.alwaysAllowed = dbInstructions.alwaysAllowedMigrations ?? {};
		this.notAllowedChanges = [];
	}
	
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
	
	public verifyRenamingTasks(newTables: Record<string, TableStructure>): Error | void {
		for(const tableName in this.migrationData) {
			const migrationEntry = this.migrationData[tableName];
			
			//Table renaming:
			if(migrationEntry.oldTableName == tableName)
				return new Error(`You set table ${tableName} to be renamed to itself!`);
			else if(!newTables[tableName])
				return new Error(`You set table ${migrationEntry.oldTableName} to be renamed to ${tableName}. But ${tableName} does not exist in your structure.`);
			
			//Column renaming:
			for(const renamingArray of migrationEntry.renamedColumns) {
				const oldColumnName = renamingArray[0];
				const newColumnName = renamingArray[renamingArray.length - 1];
				
				if(oldColumnName == newColumnName)
					return new Error(`You set column ${tableName}.${oldColumnName} to be renamed to itself!`);
				else if(!newTables[tableName]?.columns.find((column) => column.name == newColumnName))
					return new Error(`You set column ${tableName}.${oldColumnName} to be renamed to ${tableName}.${newColumnName}. But ${tableName}.${newColumnName} does not exist in your structure.`);
			}
		}
	}
	public verifyAllowedMigrations(): Error | void {
		if(this.notAllowedChanges.length)
			return new MigrationNotAllowedException(this.notAllowedChanges);
	}
	
	public compareWithAllowedMigration(tableName: string, type: keyof AllowedMigrations): void {
		if(!this.migrationData[tableName]?.allowedMigrations[type] && !this.alwaysAllowed[type])
			this.notAllowedChanges.push({version: this.toVersion, tableName: tableName, type: type});
	}
	
	public allowMigration(version: number, table: string | Class<BackendTable>, ... allowedMigrations: (keyof AllowedMigrations)[]): void {
		if(version < this.fromVersion || version > this.toVersion)
			return;
		const entry = this.getEntry(table);
		
		for(const key of allowedMigrations) {
			entry.allowedMigrations[key] = true;
		}
	}
	
	public renameTable(version: number, oldTableName: string, newTable: string | Class<BackendTable>) {
		if(version < this.fromVersion || version > this.toVersion)
			return;
		const entry = this.getEntry(newTable);
		entry.recreate = true;
		if(!entry.oldTableName) //entry might have already existed
			entry.oldTableName = oldTableName;
	}
	
	public renameColumn(version: number, table: string | Class<BackendTable>, oldColumn: string, newColumn: string): void {
		if(version < this.fromVersion || version > this.toVersion)
			return;
		const entry = this.getEntry(table);
		const existingColumnEntry = entry.renamedColumns.find((entry) => entry[entry.length - 1] == oldColumn);
		
		if(existingColumnEntry)
			existingColumnEntry.push(newColumn);
		else
			entry.renamedColumns.push([oldColumn, newColumn]);
	}
	public recreateTableImp(table: Class<BackendTable> | string) {
		const entry = this.getEntry(table);
		entry.recreate = true;
	}
	public recreateTable(version: number, table: Class<BackendTable> | string) {
		if(version < this.fromVersion || version > this.toVersion)
			return;
		this.recreateTableImp(table);
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
		const columnNames = this.migrationData[tableName]?.renamedColumns.find((columns) => columns[0] == oldColumnName);
		return columnNames ? columnNames[columnNames.length - 1] : oldColumnName;
	}
	
	public willBeRecreated(tableName: string): boolean {
		return this.migrationData[tableName]?.recreate;
	}
}

export type PublicMigrations = Pick<Migrations, "recreateTable" | "renameTable" | "renameColumn" | "allowMigration">;