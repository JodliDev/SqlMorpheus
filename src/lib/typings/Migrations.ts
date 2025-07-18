import {Class, BackendTable} from "./BackendTable";
import AllowedMigrations from "./AllowedMigrations";
import MigrationInstructions from "./MigrationInstructions";
import MigrationNotAllowedException from "../exceptions/NotAllowedException";
import DatabaseInstructions from "./DatabaseInstructions";
import {TableStructure} from "./TableStructure";

export type NotAllowedChangeEntry = {version: number, tableName: string, type: keyof AllowedMigrations};

export class Migrations {
	private fromVersion: number = 0;
	private toVersion: number = 0;
	private lastUsedVersion: number = 0;
	private migrationData: Record<string, MigrationInstructions> = {};
	private migrationDataForOldTableNames: Record<string, MigrationInstructions> = {};
	private alwaysAllowed: AllowedMigrations = {};
	private notAllowedChanges: NotAllowedChangeEntry[] = [];
	
	
	public reset(dbInstructions: DatabaseInstructions, fromVersion: number) {
		this.fromVersion = fromVersion;
		this.toVersion = dbInstructions.version;
		this.migrationData = {};
		this.migrationDataForOldTableNames = {};
		this.alwaysAllowed = dbInstructions.alwaysAllowedMigrations ?? {};
		this.notAllowedChanges = [];
	}
	
	private getEntry(table: string | Class<BackendTable>): MigrationInstructions {
		const tableName = this.getTableName(table);
		if(!this.migrationData.hasOwnProperty(tableName)) {
			this.migrationData[tableName] = {
				recreate: false,
				renamedColumns: [],
				allowedMigrations: {},
				usedMigrations: {}
			};
		}
		return this.migrationData[tableName]
	}
	private getTableName(table: string | Class<BackendTable>): string {
		return typeof table == "string" ? table : table.name;
	}
	
	private versionIsRelevant(version: number): boolean {
		if(version < this.fromVersion || version > this.toVersion)
			return false;
		
		if(version < this.lastUsedVersion)
			throw new Error("Migrations in preMigration() have to be ordered by version (beginning with the lowest version).");
		this.lastUsedVersion = version;
		return true;
	}
	
	public verifyRenamingTasks(newTables: Record<string, TableStructure>): Error | void {
		for(const tableName in this.migrationData) {
			const migrationEntry = this.migrationData[tableName];
			
			//Tables:
			if(migrationEntry.tableRenaming?.oldName == tableName)
				return new Error(`You set table "${tableName}" to be renamed to itself!`);
			if(migrationEntry.tableRenaming && migrationEntry.tableRenaming.newName != tableName)
				return new Error(`You set table "${tableName}" to be renamed to a different name than the one in your structure (${migrationEntry.tableRenaming.newName})!`);
			else if(!newTables[tableName])
				return new Error(`You set table "${migrationEntry.tableRenaming}" migrations for "${tableName}". But "${tableName}" does not exist in your structure.`);
			
			//Columns:
			for(const renamingData of migrationEntry.renamedColumns) {
				const oldColumnName = renamingData.oldName;
				const newColumnName = renamingData.newName;
				
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
		
		let errorMsg = "";
		for(const tableName in this.migrationData) {
			const migration = this.migrationData[tableName];
			for(const type in migration.allowedMigrations) {
				if(!migration.usedMigrations[type])
					errorMsg += `Migration \"${type}\" for ${tableName} was allowed but not needed.\n`;
			}
		}
		
		if(errorMsg)
			return new Error(errorMsg);
	}
	
	public compareWithAllowedMigration(tableName: string, type: keyof AllowedMigrations): void {
		const migrationEntry = this.migrationData[tableName];
		
		if(!migrationEntry?.allowedMigrations[type]) {
			if(!this.alwaysAllowed[type])
				this.notAllowedChanges.push({version: this.toVersion, tableName: tableName, type: type});
		}
		else if(migrationEntry)
			migrationEntry.usedMigrations[type] = true;
	}
	
	public getMigrationData(): Record<string, MigrationInstructions> {
		return this.migrationData;
	}
	
	public loopRenamedColumns(tableName: string, callback: (oldColumnName: string, newColumnName: string) => void): void {
		const migrationEntry = this.migrationData[tableName];
		
		for(const renamingData of migrationEntry.renamedColumns) {
			callback(renamingData.oldName, renamingData.newName);
		}
	}
	
	public getNewestTableName(tableName: string): string {
		return this.migrationDataForOldTableNames[tableName]?.tableRenaming?.newName ?? tableName;
	}
	public getOldTableName(tableName: string): string {
		return this.migrationData[tableName]?.tableRenaming?.oldName ?? tableName;
	}
	public getNewestColumnName(tableName: string, oldColumnName: string): string {
		const columnNames = this.migrationData[tableName]?.renamedColumns.find((columns) => columns.oldName == oldColumnName);
		return columnNames ? columnNames.newName : oldColumnName;
	}
	
	public willBeRecreated(tableName: string): boolean {
		return this.migrationData[tableName]?.recreate;
	}
	
	public recreateTableImp(table: Class<BackendTable> | string) {
		const entry = this.getEntry(table);
		entry.recreate = true;
	}
	
	
	
	public allowMigration(version: number, table: string | Class<BackendTable>, ... allowedMigrations: (keyof AllowedMigrations)[]): void {
		if(version < this.fromVersion || version > this.toVersion)
			return;
		const entry = this.getEntry(table);
		
		for(const key of allowedMigrations) {
			entry.allowedMigrations[key] = true;
		}
	}
	
	public renameTable(version: number, oldTableName: string, newTableName: string | Class<BackendTable>) {
		if(!this.versionIsRelevant(version))
			return;
		const newTableNameString = this.getTableName(newTableName);
		
		//Make sure migration data is always saved under the current table name:
		if(this.migrationData.hasOwnProperty(oldTableName)) {
			this.migrationData[newTableNameString] = this.getEntry(oldTableName);
			delete this.migrationData[oldTableName];
		}
		
		//add data for renaming:
		const entry = this.getEntry(newTableName);
		this.migrationDataForOldTableNames[oldTableName] = entry;
		
		if(!entry.tableRenaming)
			entry.tableRenaming = {oldName: oldTableName, newName: newTableNameString};
		else
			entry.tableRenaming.newName = newTableNameString;
	}
	
	public renameColumn(version: number, table: string | Class<BackendTable>, oldColumn: string, newColumn: string): void {
		if(!this.versionIsRelevant(version))
			return;
		const entry = this.getEntry(table);
		const existingColumnEntry = entry.renamedColumns.find((entry) => entry.newName == oldColumn);
		
		if(existingColumnEntry)
			existingColumnEntry.newName = newColumn;
		else
			entry.renamedColumns.push({oldName: oldColumn, newName: newColumn});
	}
	public recreateTable(version: number, table: Class<BackendTable> | string) {
		if(!this.versionIsRelevant(version))
			return;
		this.recreateTableImp(table);
	}
}

export type PublicMigrations = Pick<Migrations, "recreateTable" | "renameTable" | "renameColumn" | "allowMigration">;