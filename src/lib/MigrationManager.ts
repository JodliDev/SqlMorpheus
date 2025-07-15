import DatabaseInstructions from "./typings/DatabaseInstructions";
import {ColumnInfo} from "./typings/ColumnInfo";
import TableStructureGenerator from "./TableStructureGenerator";
import {Migrations} from "./typings/Migrations";
import {DatabaseAccess} from "./typings/DatabaseAccess";
import MigrationHistoryManager from "./MigrationHistoryManager";
import DefaultSql from "./dialects/DefaultSql";
import SqliteDialect from "./dialects/SqliteDialect";
import {SqlChanges} from "./typings/SqlChanges";
import {ForeignKeyInfo} from "./typings/ForeignKeyInfo";
import PostgresDialect from "./dialects/PostgresDialect";
import MsSqlDialect from "./dialects/MsSqlDialect";
import MySqlDialect from "./dialects/MySqlDialect";
import {Logger} from "./Logger";


export class MigrationManager {
	private migrations = new Migrations()
	
	private readonly tableStructureGenerator: TableStructureGenerator;
	private existingTables: string[] = [];
	private readonly db: DatabaseAccess;
	private readonly dbInstructions: DatabaseInstructions;
	private readonly migrationHistoryManager: MigrationHistoryManager;
	private readonly dialect: DefaultSql;
	
	constructor(db: DatabaseAccess, dbInstructions: DatabaseInstructions) {
		switch(dbInstructions.dialect) {
			case "Sqlite":
				this.dialect = new SqliteDialect();
				break;
			case "Postgres":
				this.dialect = new PostgresDialect();
				break;
			case "MsSql":
				this.dialect = new MsSqlDialect();
				break;
			case "MySql":
				this.dialect = new MySqlDialect();
				break;
			default:
				throw new Error(`Unknown dialect ${dbInstructions.dialect}`);
		}
		
		this.db = db;
		this.dbInstructions = dbInstructions;
		this.tableStructureGenerator = new TableStructureGenerator(dbInstructions, this.dialect);
		this.migrationHistoryManager = new MigrationHistoryManager(this.dbInstructions.configPath);
	}
	
	public async getMigrateSql(): Promise<SqlChanges | null> {
		if(this.dbInstructions.version <= 0)
			throw new Error("Cannot migrate to version 0 or lower");
		
		const fromVersion = this.migrationHistoryManager.getLastHistoryVersion();
		if(fromVersion == 0) {
			Logger.log(`Creating initial migration to version ${this.dbInstructions.version}`);
			return this.createAndDropTables();
		}
		
		if(fromVersion == this.dbInstructions.version) {
			Logger.log("Version has not changed. No migrations needed.")
			return null;
		}
		if(fromVersion > this.dbInstructions.version)
			throw new Error(`You cannot create new migrations with a lower version (from ${fromVersion} to ${this.dbInstructions.version})`);
		
		Logger.log(`Creating migration SQL from version ${fromVersion} to ${this.dbInstructions.version}`);
		
		const db = this.db;
		await db.createBackup?.(`from_${fromVersion}_to_${this.dbInstructions.version}`);
		
		this.existingTables = await this.dialect.getTableNames(this.db);
		
		const foreignKeyOffQuery = this.dialect.changeForeignKeysState(false);
		const changes = {
			up: foreignKeyOffQuery,
			down: foreignKeyOffQuery
		} satisfies SqlChanges;
		
		//Run pre-migrations:
		const preSQL = this.dbInstructions.preMigration?.(
			this.migrations,
			fromVersion,
			this.dbInstructions.version,
		);
		if(preSQL) {
			changes.up += `\n\n-- Custom SQL from preMigration()\n${preSQL.up}`;
			changes.down += `\n\n-- Custom SQL from preMigration()\n${preSQL.down}`;
		}
		
		[
			await this.createAndDropTables(),
			await this.migrateForeignKeys(),
			await this.migrateColumns(),
			this.renameColumns(),
			await this.recreateTables()
		].forEach(entry => {
			changes.up += entry.up;
			changes.down += entry.down;
		})
		
		//Run post-migrations:
		const postSql = this.dbInstructions.postMigration?.(fromVersion, this.dbInstructions.version);
		if(postSql) {
			changes.up += `\n\n-- Custom SQL from postMigration()\n${postSql.up}`;
			changes.down += `\n\n-- Custom SQL from postMigration()\n${postSql.down}`;
		}
		
		
		//Enable foreign key constraints again:
		const foreignKeyOnQuery = this.dialect.changeForeignKeysState(true);
		changes.up += `\n\n${foreignKeyOnQuery}`;
		changes.down += `\n\n${foreignKeyOnQuery}`;
		
		return changes;
	}
	public async prepareMigration(overwriteExisting?: boolean): Promise<void> {
		const changes = await this.getMigrateSql();
		if(!changes)
			return;
		
		this.migrationHistoryManager.createMigrationHistory(this.dbInstructions.version, changes, overwriteExisting);
	}
	
	private async createAndDropTables(): Promise<SqlChanges> {
		let changes = {
			up: "\n\n-- Create tables\n",
			down: "\n\n-- Create tables\n"
		} satisfies SqlChanges;
		
		for(const tableName in this.tableStructureGenerator.tables) {
			if(this.tableDoesNotExists(tableName)) {
				const structure = this.tableStructureGenerator.tables[tableName];
				changes.up += `${this.createTableSql(tableName, structure.columns, structure.foreignKeys)}\n`;
				changes.down += `${this.dialect.dropTable(tableName)}\n`;
			}
		}
		
		for(const tableName of this.existingTables) {
			if(!this.tableStructureGenerator.tables[tableName]) {
				this.migrations.throwIfNotAllowed(this.dbInstructions.version, tableName, "dropTable");
				if(!this.dialect.canInspectForeignKeys || !this.dialect.canInspectPrimaryKey)
					this.migrations.throwIfNotAllowed(this.dbInstructions.version, tableName, "continueWithoutRollback");
				
				changes.up += `${this.dialect.dropTable(tableName)}\n`;
				changes.down += this.dialect.canInspectForeignKeys && this.dialect.canInspectPrimaryKey
					? this.createTableSql(tableName, await this.dialect.getColumnInformation(tableName, this.db), await this.dialect.getForeignKeys(tableName, this.db))
					: "\n\n-- Cannot recreate foreign keys or load primary keys with this database! Table will not be recreated!\n";
			}
		}
		
		return changes;
	}
	
	private createTableSql(tableName: string, columns: ColumnInfo[], foreignKeys?: ForeignKeyInfo[]): string {
		
		//columns:
		const queryLines = [];
		for(const columnInfo of columns) {
			queryLines.push(this.dialect.columnDefinition(columnInfo.name, columnInfo.type, columnInfo.defaultValue, columnInfo.isPrimaryKey))
		}
		
		//foreign keys:
		if(foreignKeys) {
			for(const foreignKeyInfo of foreignKeys) {
				queryLines.push(this.dialect.foreignKey(foreignKeyInfo.fromColumn, foreignKeyInfo.toTable, foreignKeyInfo.toColumn.toString(), foreignKeyInfo.onUpdate, foreignKeyInfo.onDelete))
			}
		}
		return this.dialect.createTable(tableName, queryLines);
	}
	
	private tableDoesNotExists(tableName: string) {
		return this.existingTables.indexOf(tableName) == -1
	}
	
	private async recreateTables(): Promise<SqlChanges> {
		const changes = {
			up: "\n\n-- Recreate tables\n",
			down: "\n\n-- Recreate tables\n"
		} satisfies SqlChanges;
		
		const migrationData = this.migrations.getMigrationData();
		for(const tableName in migrationData) {
			const migrationEntry = migrationData[tableName];
			
			if(!migrationEntry.recreate)
				continue;
			
			this.migrations.throwIfNotAllowed(this.dbInstructions.version, tableName, "recreateTable");
			if(!this.dialect.canInspectForeignKeys || !this.dialect.canInspectPrimaryKey)
				this.migrations.throwIfNotAllowed(this.dbInstructions.version, tableName, "continueWithoutRollback");
				
			const oldColumnList = await this.dialect.getColumnInformation(tableName, this.db);
			const newColumnList = this.tableStructureGenerator.tables[tableName].columns;
			const moveableColumns = newColumnList
				.filter(entry => oldColumnList.find(oldEntry => oldEntry.name == entry.name) != undefined)
				.map(entry => entry.name);
			
			const backupTableName = `${tableName}__backup`;
			const insertQuery = this.dialect.insert(
				backupTableName,
				this.dialect.insertValues(moveableColumns, this.dialect.select(tableName, moveableColumns))
			);
			const moveDataQuery = insertQuery
				+ "\n"
				+ this.dialect.dropTable(tableName)
				+ "\n"
				+ this.dialect.renameTable(backupTableName, tableName);
			
			const structure = this.tableStructureGenerator.tables[tableName];
			changes.up += this.createTableSql(backupTableName, structure.columns, structure.foreignKeys)
				+ "\n"
				+ moveDataQuery
			
			changes.down += this.dialect.canInspectForeignKeys && this.dialect.canInspectPrimaryKey
				? this.createTableSql(backupTableName, await this.dialect.getColumnInformation(tableName, this.db), await this.dialect.getForeignKeys(tableName, this.db))
				+ "\n"
				+ moveDataQuery
				: "\n\n-- Cannot recreate foreign keys or load primary keys with this database! Table will not be recreated!\n";
		}
		
		return changes;
	}
	
	private async migrateForeignKeys(): Promise<SqlChanges> {
		if(!this.dialect.canAlterForeignKeys)
			return {up: "", down: ""};
		
		let changes = {
			up: "\n\n-- Foreign keys\n",
			down: "\n\n-- Foreign keys\n"
		} satisfies SqlChanges;
		
		for(const tableName in this.tableStructureGenerator.tables) {
			if(this.migrations.willBeRecreated(tableName) || this.tableDoesNotExists(tableName))
				continue;
			const structure = this.tableStructureGenerator.tables[tableName];
			const newForeignKeys = structure.foreignKeys ?? [];
			const oldForeignKeys = await this.dialect.getForeignKeys(tableName, this.db);
			
			let checkForNewForeignKeys = true;
			
			for(const oldForeignKey of oldForeignKeys) {
				const newForeignKey = newForeignKeys.find(entry => entry.fromColumn == oldForeignKey.fromColumn);
				
				//Check for removed foreign key:
				if(!newForeignKey) {
					Logger.log(`Foreign key ${oldForeignKey.toTable}.${oldForeignKey.toColumn} to ${oldForeignKey.toTable}.${oldForeignKey.toColumn} was removed!`);
					this.migrations.throwIfNotAllowed(this.dbInstructions.version, tableName, "removeForeignKey");
					if(this.dialect.canAlterForeignKeys) {
						changes.up += this.dialect.removeForeignKey(oldForeignKey.fromTable, oldForeignKey.fromColumn);
						changes.down += this.dialect.addForeignKey(
							oldForeignKey.fromTable,
							this.dialect.foreignKey(oldForeignKey.fromColumn, oldForeignKey.toTable, oldForeignKey.toColumn, oldForeignKey.onUpdate, oldForeignKey.onDelete)
						);
					}
					else {
						this.migrations.recreateTable(structure.table);
						checkForNewForeignKeys = false;
					}
				}
				//Check for altered foreign key:
				else {
					if(!newForeignKey
						|| oldForeignKey.toColumn != newForeignKey.toColumn
						|| ((oldForeignKey.onUpdate ?? "NO ACTION") != (newForeignKey.onUpdate ?? "NO ACTION"))
						|| ((oldForeignKey.onDelete ?? "NO ACTION") != (newForeignKey.onDelete ?? "NO ACTION"))
					) {
						Logger.log(`Foreign key ${oldForeignKey.toTable}.${oldForeignKey.toColumn} to ${oldForeignKey.toTable}.${oldForeignKey.toColumn} was changed!`);
						this.migrations.throwIfNotAllowed(this.dbInstructions.version, tableName, "alterForeignKey");
						if(this.dialect.canAlterForeignKeys) {
							changes.up += this.dialect.removeForeignKey(oldForeignKey.fromTable, oldForeignKey.fromColumn)
								+ this.dialect.addForeignKey(
									newForeignKey.fromTable,
									this.dialect.foreignKey(newForeignKey.fromColumn, newForeignKey.toTable, newForeignKey.toColumn, newForeignKey.onUpdate, newForeignKey.onDelete)
								)
							changes.down += this.dialect.addForeignKey(
								oldForeignKey.fromTable,
								this.dialect.foreignKey(oldForeignKey.fromColumn, oldForeignKey.toTable, oldForeignKey.toColumn, oldForeignKey.onUpdate, oldForeignKey.onDelete)
							) + this.dialect.removeForeignKey(newForeignKey.fromTable, newForeignKey.fromColumn);
							
						}
						else {
							this.migrations.recreateTable(structure.table);
							checkForNewForeignKeys = false;
						}
					}
				}
			}
			
			//Check for new foreign keys:
			if(checkForNewForeignKeys) {
				for(const newForeignKey of newForeignKeys) {
					const oldForeignKey = oldForeignKeys.find(entry => entry.fromColumn == newForeignKey.fromColumn);
					
					if(oldForeignKey)
						continue;
					
					Logger.log(`Foreign key ${newForeignKey.toTable}.${newForeignKey.toColumn} to ${newForeignKey.toTable}.${newForeignKey.toColumn} is new!`);
					if(this.dialect.canAlterForeignKeys) {
						changes.up += this.dialect.addForeignKey(
							newForeignKey.toTable,
							this.dialect.foreignKey(newForeignKey.fromColumn, newForeignKey.toTable, newForeignKey.toColumn, newForeignKey.onUpdate, newForeignKey.onDelete)
						);
						
						changes.down += this.dialect.removeForeignKey(newForeignKey.fromTable, newForeignKey.fromColumn);
					} else {
						this.migrations.recreateTable(structure.table);
						break;
					}
				}
			}
		}
		
		return changes;
	}
	
	/**
	 * Checks all columns of all tables, creates them if they do not exist in the database and modifies them if needed.
	 * If types, default values or primary key change, the table is recreated
	 */
	private async migrateColumns(): Promise<SqlChanges> {
		const changes = {
			up: "\n\n-- Migrate columns\n",
			down: "\n\n-- Migrate columns\n"
		} satisfies SqlChanges;
		
		for(const tableName in this.tableStructureGenerator.tables) {
			if(this.migrations.willBeRecreated(tableName) || this.tableDoesNotExists(tableName))
				continue;
			
			const newTableDefinition = this.tableStructureGenerator.tables[tableName];
			
			const oldColumnList = await this.dialect.getColumnInformation(tableName, this.db);
			
			const oldPrimaryKey = this.dialect.canInspectPrimaryKey ? this.getPrimaryKeyColumn(oldColumnList) : false;
			
			const newColumnList = newTableDefinition.columns;
			const newPrimaryKey = newTableDefinition.primaryKey;
			
			//Search for changed primary key:
			if(this.dialect.canInspectPrimaryKey && oldPrimaryKey != newPrimaryKey) {
				Logger.log(`Primary key in ${tableName} was changed from ${oldPrimaryKey} to ${newPrimaryKey}!`);
				this.migrations.throwIfNotAllowed(this.dbInstructions.version, tableName, "alterPrimaryKey");
				if(this.dialect.canAlterPrimaryKey) {
					if(oldPrimaryKey) {
						changes.up += this.dialect.removePrimaryKey(tableName, oldPrimaryKey);
						changes.down += this.dialect.addPrimaryKey(tableName, oldPrimaryKey);
					}
					if(newPrimaryKey) {
						changes.up += this.dialect.addPrimaryKey(tableName, newPrimaryKey.toString());
						changes.down += this.dialect.removePrimaryKey(tableName, newPrimaryKey.toString());
					}
				}
				else
					this.migrations.recreateTable(newTableDefinition.table);
				continue;
			}
			
			//Search for added or changed columns:
			for(const newColumn of newColumnList) {
				const oldColumn = oldColumnList.find(entry => entry.name == newColumn.name);
				
				if(oldColumn == undefined) {
					changes.up += this.dialect.createColumn(tableName, this.dialect.columnDefinition(newColumn.name, newColumn.type, newColumn.defaultValue, newColumn.isPrimaryKey)) + "\n";
					changes.down += this.dialect.dropColumn(tableName, newColumn.name) + "\n";
				}
				else if(newColumn.type != oldColumn.type || newColumn.defaultValue != oldColumn.defaultValue) {
					this.migrations.recreateTable(newTableDefinition.table);
				}
			}
			
			//Search for removed columns:
			for(const oldColumn of oldColumnList) {
				const newColumn = newColumnList.find(entry => entry.name == oldColumn.name);
				if(newColumn == undefined) {
					this.migrations.throwIfNotAllowed(this.dbInstructions.version, tableName, "dropColumn");
					changes.up += this.dialect.dropColumn(tableName, oldColumn.name) + "\n";
					changes.down += this.dialect.createColumn(tableName, this.dialect.columnDefinition(oldColumn.name, oldColumn.type, oldColumn.defaultValue, oldColumn.isPrimaryKey)) + "\n";
				}
			}
		}
		
		return changes;
	}
	
	private getPrimaryKeyColumn(columnInfoList: ColumnInfo[]): string | undefined{
		for(const columnInfo of columnInfoList) {
			if(columnInfo.isPrimaryKey)
				return columnInfo.name
		}
	}
	
	private renameColumns(): SqlChanges {
		const changes = {
			up: "\n\n-- Rename columns\n",
			down: "\n\n-- Rename columns\n"
		} satisfies SqlChanges;
		
		const migrationData = this.migrations.getMigrationData();
		
		for(const tableName in migrationData) {
			if(migrationData[tableName].recreate)
				continue;
			
			this.migrations.loopRenamedColumns(tableName, (oldColumnName, newColumnName) => {
				changes.up += this.dialect.renameColumn(tableName, oldColumnName, newColumnName);
				changes.down += this.dialect.renameColumn(tableName, newColumnName, oldColumnName);
			})
		}
		return changes;
	}
}
