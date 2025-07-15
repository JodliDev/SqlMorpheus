"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  prepareAndRunMigration: () => prepareAndRunMigration,
  prepareMigration: () => prepareMigration,
  rollback: () => rollback,
  runPreparedMigrations: () => runPreparedMigrations
});
module.exports = __toCommonJS(index_exports);

// src/lib/Logger.ts
var LoggerClass = class {
  mode = "normal";
  setMode(mode) {
    this.mode = mode ?? "normal";
  }
  debug(text) {
    if (this.mode == "debug")
      console.log(text);
  }
  log(text) {
    if (this.mode == "silent" || this.mode == "noLog")
      return;
    console.log(text);
  }
  warn(text) {
    if (this.mode == "silent")
      return;
    console.warn(text);
  }
};
var Logger = new LoggerClass();

// src/lib/tableInfo/TableInfo.ts
var TABLE_INFO_PROPERTY_NAME = Symbol("tableInfo");
function getTableInfo(table) {
  if (!table.hasOwnProperty(Symbol.metadata))
    table[Symbol.metadata] = {};
  return getTableInfoFromMetadata(table[Symbol.metadata]);
}
function getTableInfoFromMetadata(metadata) {
  if (!metadata[TABLE_INFO_PROPERTY_NAME])
    metadata[TABLE_INFO_PROPERTY_NAME] = { primaryKey: "", foreignKeys: [] };
  return metadata[TABLE_INFO_PROPERTY_NAME];
}

// src/lib/TableStructureGenerator.ts
var TableStructureGenerator = class {
  dialect;
  tables = {};
  constructor(dbContext, dialect) {
    this.dialect = dialect;
    if (dbContext.tables.length) {
      const tableObjects = {};
      for (const table of dbContext.tables) {
        tableObjects[table.name] = { columns: new table(), tableInfo: getTableInfo(table) };
      }
      this.getExpectedStructure(tableObjects);
    } else {
      const tableObjects = dbContext.tables;
      this.getExpectedStructure(tableObjects);
    }
  }
  getExpectedStructure(tableObjects) {
    for (const tableName in tableObjects) {
      const obj = tableObjects[tableName];
      const tableInfo = obj.tableInfo;
      this.tables[tableName] = {
        table: tableName,
        primaryKey: tableInfo?.primaryKey,
        columns: this.getColumns(obj.columns, tableInfo?.primaryKey),
        foreignKeys: tableInfo?.foreignKeys
      };
    }
  }
  getColumns(obj, primaryKey) {
    const columns = [];
    for (const property in obj) {
      const propertyKey = property;
      const value = obj[propertyKey];
      const columnData = {
        name: property,
        isPrimaryKey: property == primaryKey,
        type: "TEXT",
        defaultValue: this.dialect.typeNull
      };
      switch (typeof value) {
        case "string":
          columnData.type = this.dialect.typeString;
          columnData.defaultValue = value === null ? this.dialect.typeNull : `"${this.dialect.formatValueToSql(value)}"`;
          break;
        case "number":
          columnData.type = this.dialect.typeNumber;
          columnData.defaultValue = value === null ? this.dialect.typeNull : this.dialect.formatValueToSql(value);
          break;
        case "boolean":
          columnData.type = this.dialect.typeBoolean;
          columnData.defaultValue = value === null ? this.dialect.typeNull : this.dialect.formatValueToSql(value);
          break;
        case "function":
          continue;
        default:
          Logger.warn(`${obj.constructor.name}.${property} was skipped because its type is not supported (${typeof value})`);
          continue;
      }
      columns.push(columnData);
    }
    return columns;
  }
};

// src/lib/exceptions/NotAllowedException.ts
var NotAllowedException = class extends Error {
  constructor(version, tableName, type) {
    const information = `You have to enable "${type}" for version "${version}" and table "${tableName}"`;
    switch (type) {
      case "continueWithoutRollback":
        super(`Some changes can not be rolled back automatically. ${information}`);
        break;
      case "dropColumn":
        super(`Not allowed to drop column. ${information}`);
        break;
      case "dropTable":
        super(`Not allowed to drop table. ${information}`);
        break;
      case "recreateTable":
        super(`Not allowed to recreate table. ${information}`);
        break;
      case "alterForeignKey":
        super(`Not allowed to alter existing foreign key. ${information}`);
        break;
      case "alterPrimaryKey":
        super(`Not allowed to alter primary key. ${information}`);
        break;
      case "removeForeignKey":
        super(`Not allowed to remove existing foreign key. ${information}`);
        break;
    }
  }
};

// src/lib/typings/Migrations.ts
var Migrations = class {
  migrationData = {};
  alwaysAllowed = {};
  getEntry(table) {
    const tableName = this.getTableName(table);
    if (!this.migrationData.hasOwnProperty(tableName)) {
      this.migrationData[tableName] = {
        recreate: false,
        renamedColumns: [],
        allowedMigrations: {}
      };
    }
    return this.migrationData[tableName];
  }
  getTableName(table) {
    return typeof table == "string" ? table : table.name;
  }
  alwaysAllow(...allowedMigrations) {
    for (const key of allowedMigrations) {
      this.alwaysAllowed[key] = true;
    }
  }
  allowMigration(version, table, ...allowedMigrations) {
    const entry = this.getEntry(table);
    if (!entry.allowedMigrations.hasOwnProperty(version))
      entry.allowedMigrations[version] = {};
    for (const key of allowedMigrations) {
      this.alwaysAllowed[key] = true;
    }
  }
  throwIfNotAllowed(version, tableName, type) {
    if (!(this.migrationData[tableName]?.allowedMigrations[version] ?? this.alwaysAllowed)[type])
      throw new NotAllowedException(version, tableName, type);
  }
  renameTable(oldTableName, newTable) {
    const entry = this.getEntry(newTable);
    entry.recreate = true;
    if (!entry.oldTableName)
      entry.oldTableName = oldTableName;
  }
  renameColumn(table, oldColumn, newColumn) {
    const entry = this.getEntry(table);
    const existingColumnEntry = entry.renamedColumns.find((entry2) => entry2[entry2.length - 1] == oldColumn);
    if (existingColumnEntry)
      existingColumnEntry.push(newColumn);
    else
      entry.renamedColumns.push([oldColumn, newColumn]);
  }
  recreateTable(table) {
    const entry = this.getEntry(table);
    entry.recreate = true;
  }
  getMigrationData() {
    return this.migrationData;
  }
  loopRenamedColumns(tableName, callback) {
    const migrationEntry = this.migrationData[tableName];
    for (const renamingArray of migrationEntry.renamedColumns) {
      if (renamingArray.length <= 1)
        continue;
      const oldColumnName = renamingArray[0];
      const newColumnName = renamingArray[renamingArray.length - 1];
      callback(oldColumnName, newColumnName);
    }
  }
  getUpdatedColumnName(tableName, oldColumnName) {
    const columnNames = this.migrationData[tableName].renamedColumns.find((columns) => columns[0] == oldColumnName);
    return columnNames ? columnNames[columnNames.length - 1] : oldColumnName;
  }
  willBeRecreated(tableName) {
    return this.migrationData[tableName]?.recreate;
  }
};

// src/lib/MigrationHistoryManager.ts
var import_node_fs = require("fs");
var import_fs = require("fs");
var FILENAME_UP_PREFIX = "up_to_";
var FILENAME_DOWN_PREFIX = "down_to_";
var MigrationHistoryManager = class {
  configPath;
  migrationsPath;
  lastVersion = 0;
  constructor(configPath) {
    this.configPath = configPath;
    this.migrationsPath = `${configPath}/migrations/`;
    (0, import_node_fs.mkdirSync)(this.configPath, { recursive: true });
    (0, import_node_fs.mkdirSync)(this.migrationsPath, { recursive: true });
  }
  getLastHistoryVersion() {
    if (this.lastVersion)
      return this.lastVersion;
    const path = `${this.configPath}/last_version.txt`;
    this.lastVersion = (0, import_node_fs.existsSync)(path) ? parseInt((0, import_fs.readFileSync)(`${this.configPath}/last_version.txt`, { encoding: "utf-8" })) ?? 0 : 0;
    return this.lastVersion;
  }
  setLastHistoryVersion(version) {
    (0, import_node_fs.writeFileSync)(`${this.configPath}/last_version.txt`, version.toString(), { encoding: "utf-8" });
  }
  createMigrationHistory(toVersion, changes, overwriteExisting) {
    const fromVersion = this.getLastHistoryVersion();
    const upPath = `${this.migrationsPath}/${FILENAME_UP_PREFIX}${toVersion}.sql`;
    const downPath = `${this.migrationsPath}/${FILENAME_DOWN_PREFIX}${fromVersion}.sql`;
    if ((0, import_node_fs.existsSync)(upPath) && !overwriteExisting)
      throw new Error(`Migration ${upPath} already exists!`);
    else if ((0, import_node_fs.existsSync)(downPath) && !overwriteExisting)
      throw new Error(`Migration ${downPath} already exists!`);
    (0, import_node_fs.writeFileSync)(`${this.migrationsPath}/${FILENAME_UP_PREFIX}${toVersion}.sql`, `-- From: Version ${fromVersion}
-- To:   Version ${toVersion}
${changes.up}`, { encoding: "utf-8" });
    (0, import_node_fs.writeFileSync)(`${this.migrationsPath}/${FILENAME_DOWN_PREFIX}${fromVersion}.sql`, `-- From: Version ${toVersion}
-- To:   Version ${fromVersion}
${changes.down}`, { encoding: "utf-8" });
  }
  getUpMigration(toVersion) {
    return (0, import_fs.readFileSync)(`${this.migrationsPath}/${FILENAME_UP_PREFIX}${toVersion ?? this.getLastHistoryVersion()}.sql`, { encoding: "utf-8" });
  }
  getDownMigration(version) {
    return (0, import_fs.readFileSync)(`${this.migrationsPath}/${FILENAME_DOWN_PREFIX}${version}.sql`, { encoding: "utf-8" });
  }
};

// src/lib/dialects/DefaultSql.ts
var DefaultSql = class {
  canAlterForeignKeys = false;
  canAlterPrimaryKey = false;
  canInspectForeignKeys = false;
  canInspectPrimaryKey = false;
  typeString = "TEXT";
  typeNumber = "INTEGER";
  typeBoolean = "BOOLEAN";
  typeNull = "NULL";
  formatValueToSql(value) {
    return value.toString();
  }
  changeForeignKeysState(enabled) {
    return "";
  }
  async getForeignKeys(tableName, db) {
    throw new Error("Inspecting foreign keys is not supported!");
  }
  addForeignKey(fromTableName, foreignKey) {
    throw new Error("Adding foreign keys is not supported!");
  }
  removeForeignKey(tableName, foreignKeyName) {
    throw new Error("Foreign key removal is not supported!");
  }
  addPrimaryKey(tableName, columnName) {
    throw new Error("Adding foreign keys is not supported!");
  }
  removePrimaryKey(tableName, columnName) {
    throw new Error("Foreign key removal is not supported!");
  }
  foreignKey(column, foreignTable, foreignColumn, onUpdate, onDelete) {
    let query = `FOREIGN KEY (${column}) REFERENCES ${foreignTable} (${foreignColumn})`;
    if (onUpdate)
      query += ` ON UPDATE ${onUpdate}`;
    if (onDelete)
      query += ` ON DELETE ${onDelete}`;
    return query;
  }
  createTable(tableName, entries) {
    return `CREATE TABLE IF NOT EXISTS ${tableName}  (
	${entries.join(",\n	")}
);`;
  }
  renameTable(tableName, newTableName) {
    return `ALTER TABLE ${tableName} RENAME TO ${newTableName};`;
  }
  dropTable(tableName) {
    return `DROP TABLE IF EXISTS ${tableName};`;
  }
  columnDefinition(tableName, type, defaultValue, isPrimaryKey) {
    const query = `${tableName} ${type} DEFAULT ${defaultValue}`;
    return isPrimaryKey ? `${query} PRIMARY KEY` : query;
  }
  createColumn(columnTable, entry) {
    return `ALTER TABLE ${columnTable} ADD ${entry};`;
  }
  renameColumn(tableName, oldColumnName, newColumnName) {
    return `ALTER TABLE ${tableName} RENAME COLUMN ${newColumnName} TO ${oldColumnName};`;
  }
  copyColumn(tableName, oldColumnName, newColumnName) {
    return `UPDATE ${tableName} SET ${newColumnName} = ${oldColumnName};`;
  }
  dropColumn(tableName, columnName) {
    return `ALTER TABLE ${tableName} DROP COLUMN ${columnName};`;
  }
  select(tableName, select, where) {
    let query = `SELECT ${select.join(",")} FROM ${tableName}`;
    if (where)
      query += ` WHERE ${where}`;
    return `${query};`;
  }
  insert(tableName, content) {
    return `INSERT INTO ${tableName} ${content};`;
  }
  insertValues(keys, valueString) {
    return `(${keys}) ${valueString ?? `VALUES (${keys.map(() => "?").join(",")})`}`;
  }
};

// src/lib/dialects/SqliteDialect.ts
var SqliteDialect = class extends DefaultSql {
  typeBoolean = "INTEGER";
  canAlterForeignKeys = false;
  canAlterPrimaryKey = false;
  canInspectForeignKeys = true;
  canInspectPrimaryKey = true;
  changeForeignKeysState(enabled) {
    return `PRAGMA foreign_keys = ${enabled ? "ON" : "OFF"};`;
  }
  async getForeignKeys(tableName, db) {
    const data = await db.runGetStatement(`PRAGMA foreign_key_list(${tableName});`);
    return data.map((entry) => {
      return {
        fromTable: tableName,
        fromColumn: entry["from"],
        toTable: entry["table"],
        toColumn: entry["to"],
        on_update: entry["on_update"],
        on_delete: entry["on_delete"]
      };
    });
  }
  async getTableNames(db) {
    return (await db.runGetStatement("SELECT name FROM sqlite_master WHERE type = 'table'")).map((obj) => obj.name);
  }
  async getColumnInformation(tableName, db) {
    const data = await db.runGetStatement(`PRAGMA table_info(${tableName})`);
    return data.map((entry) => {
      return {
        name: entry["name"],
        type: entry["type"],
        defaultValue: entry["dflt_value"],
        isPrimaryKey: entry["pk"] == "1"
      };
    });
  }
  formatValueToSql(value) {
    switch (typeof value) {
      case "boolean":
        return value ? "1" : "0";
      default:
        return value.toString();
    }
  }
};

// src/lib/dialects/PostgresDialect.ts
var PostgresDialect = class extends DefaultSql {
  canAlterForeignKeys = true;
  canAlterPrimaryKey = true;
  canInspectForeignKeys = false;
  canInspectPrimaryKey = false;
  changeForeignKeysState(enabled) {
    return `SET session_replication_role = '${enabled ? "replica" : "origin"}';`;
  }
  addForeignKey(fromTableName, foreignKey) {
    return `ALTER TABLE ${fromTableName} ADD CONSTRAINT ${fromTableName} ${foreignKey};`;
  }
  removeForeignKey(tableName, foreignKeyName) {
    return `ALTER TABLE ${tableName} DROP CONSTRAINT ${foreignKeyName};`;
  }
  async getTableNames(db) {
    return await db.runGetStatement("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';");
  }
  async getColumnInformation(tableName, db) {
    const data = await db.runGetStatement(`SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tableName}';`);
    return data.map((entry) => {
      return {
        name: entry["column_name"],
        type: entry["data_type"],
        defaultValue: entry["column_default"],
        isPrimaryKey: false
      };
    });
  }
  addPrimaryKey(tableName, columnName) {
    return `ALTER TABLE ${tableName} ADD PRIMARY KEY (${columnName});
`;
  }
  removePrimaryKey(tableName, columnName) {
    return `ALTER TABLE ${tableName} DROP CONSTRAINT ${columnName};
`;
  }
};

// src/lib/dialects/MsSqlDialect.ts
var MsSqlDialect = class extends DefaultSql {
  canAlterForeignKeys = true;
  canAlterPrimaryKey = true;
  canInspectForeignKeys = true;
  canInspectPrimaryKey = false;
  changeForeignKeysState(enabled) {
    return `EXEC sp_MSforeachtable "${enabled ? "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT all" : "ALTER TABLE ? NOCHECK CONSTRAINT all"}"`;
  }
  async getForeignKeys(tableName, db) {
    const data = await db.runGetStatement(`EXEC sp_fkeys @fktable_name = ${tableName};`);
    return data.map((entry) => {
      return {
        fromTable: entry[tableName],
        fromColumn: entry["FKCOLUMN_NAME"],
        toTable: entry["PKTABLE_NAME"],
        toColumn: entry["PKCOLUMN_NAME"]
      };
    });
  }
  addForeignKey(fromTableName, foreignKey) {
    return `ALTER TABLE ${fromTableName} ADD ${foreignKey};`;
  }
  removeForeignKey(tableName, foreignKeyName) {
    return `ALTER TABLE ${tableName} DROP CONSTRAINT ${foreignKeyName};`;
  }
  addPrimaryKey(tableName, columnName) {
    return `ALTER TABLE ${tableName} ADD CONSTRAINT ${tableName}_primary PRIMARY KEY (${columnName});`;
  }
  removePrimaryKey(tableName, columnName) {
    return `ALTER TABLE ${tableName} DROP CONSTRAINT ${columnName}_primary;`;
  }
  async getTableNames(db) {
    return await db.runGetStatement("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
  }
  async getColumnInformation(tableName, db) {
    const data = await db.runGetStatement(`SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = N'${tableName};'`);
    return data.map((entry) => {
      return {
        name: entry["COLUMN_NAME"],
        type: entry["DATA_TYPE"],
        defaultValue: entry["COLUMN_DEFAULT"],
        isPrimaryKey: false
      };
    });
  }
};

// src/lib/dialects/MySqlDialect.ts
var MySqlDialect = class extends DefaultSql {
  canAlterForeignKeys = true;
  canAlterPrimaryKey = true;
  canInspectForeignKeys = true;
  canInspectPrimaryKey = true;
  changeForeignKeysState(enabled) {
    return `SET FOREIGN_KEY_CHECKS ${enabled ? "1" : "0"}
;`;
  }
  async getForeignKeys(tableName, db) {
    const data = await db.runGetStatement(`SELECT TABLE_NAME,COLUMN_NAME,CONSTRAINT_NAME, REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA = (SELECT DATABASE()) AND REFERENCED_TABLE_NAME = '${tableName}';`);
    return data.map((entry) => {
      return {
        fromTable: tableName,
        fromColumn: entry["COLUMN_NAME"],
        toTable: entry["REFERENCED_TABLE_NAME"],
        toColumn: entry["REFERENCED_COLUMN_NAME"]
      };
    });
  }
  addForeignKey(fromTableName, foreignKey) {
    return `ALTER TABLE ${fromTableName} ADD ${foreignKey};`;
  }
  removeForeignKey(tableName, foreignKeyName) {
    return `ALTER TABLE ${tableName} DROP FOREIGN KEY ${foreignKeyName};`;
  }
  addPrimaryKey(tableName, columnName) {
    return `ALTER TABLE ${tableName} PRIMARY KEY (${columnName});`;
  }
  removePrimaryKey(tableName, _columnName) {
    return `ALTER TABLE ${tableName} PRIMARY KEY;`;
  }
  async getTableNames(db) {
    return await db.runGetStatement("SHOW TABLES;");
  }
  async getColumnInformation(tableName, db) {
    const data = await db.runGetStatement(`SHOW COLUMNS FROM ${tableName};`);
    return data.map((entry) => {
      return {
        name: entry["Field"],
        type: entry["Type"],
        defaultValue: entry["Default"],
        isPrimaryKey: entry["Key"] == "PRI"
      };
    });
  }
};

// src/lib/MigrationManager.ts
var MigrationManager = class {
  migrations = new Migrations();
  tableStructureGenerator;
  existingTables = [];
  db;
  dbInstructions;
  migrationHistoryManager;
  dialect;
  constructor(db, dbInstructions) {
    switch (dbInstructions.dialect) {
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
  async getMigrateSql() {
    if (this.dbInstructions.version <= 0)
      throw new Error("Cannot migrate to version 0 or lower");
    const fromVersion = this.migrationHistoryManager.getLastHistoryVersion();
    if (fromVersion == 0) {
      Logger.log(`Creating initial migration to version ${this.dbInstructions.version}`);
      return this.createAndDropTables();
    }
    if (fromVersion == this.dbInstructions.version) {
      Logger.log("Version has not changed. No migrations needed.");
      return null;
    }
    if (fromVersion > this.dbInstructions.version)
      throw new Error(`You cannot create new migrations with a lower version (from ${fromVersion} to ${this.dbInstructions.version})`);
    Logger.log(`Creating migration SQL from version ${fromVersion} to ${this.dbInstructions.version}`);
    const db = this.db;
    await db.createBackup?.(`from_${fromVersion}_to_${this.dbInstructions.version}`);
    this.existingTables = await this.dialect.getTableNames(this.db);
    const foreignKeyOffQuery = this.dialect.changeForeignKeysState(false);
    const changes = {
      up: foreignKeyOffQuery,
      down: foreignKeyOffQuery
    };
    const preSQL = this.dbInstructions.preMigration?.(
      this.migrations,
      fromVersion,
      this.dbInstructions.version
    );
    if (preSQL) {
      changes.up += `

-- Custom SQL from preMigration()
${preSQL.up}`;
      changes.down += `

-- Custom SQL from preMigration()
${preSQL.down}`;
    }
    [
      await this.createAndDropTables(),
      await this.migrateForeignKeys(),
      await this.migrateColumns(),
      this.renameColumns(),
      await this.recreateTables()
    ].forEach((entry) => {
      changes.up += entry.up;
      changes.down += entry.down;
    });
    const postSql = this.dbInstructions.postMigration?.(fromVersion, this.dbInstructions.version);
    if (postSql) {
      changes.up += `

-- Custom SQL from postMigration()
${postSql.up}`;
      changes.down += `

-- Custom SQL from postMigration()
${postSql.down}`;
    }
    const foreignKeyOnQuery = this.dialect.changeForeignKeysState(true);
    changes.up += `

${foreignKeyOnQuery}`;
    changes.down += `

${foreignKeyOnQuery}`;
    return changes;
  }
  async prepareMigration(overwriteExisting) {
    const changes = await this.getMigrateSql();
    if (!changes)
      return;
    this.migrationHistoryManager.createMigrationHistory(this.dbInstructions.version, changes, overwriteExisting);
  }
  async createAndDropTables() {
    let changes = {
      up: "\n\n-- Create tables\n",
      down: "\n\n-- Create tables\n"
    };
    for (const tableName in this.tableStructureGenerator.tables) {
      if (this.tableDoesNotExists(tableName)) {
        const structure = this.tableStructureGenerator.tables[tableName];
        changes.up += `${this.createTableSql(tableName, structure.columns, structure.foreignKeys)}
`;
        changes.down += `${this.dialect.dropTable(tableName)}
`;
      }
    }
    for (const tableName of this.existingTables) {
      if (!this.tableStructureGenerator.tables[tableName]) {
        this.migrations.throwIfNotAllowed(this.dbInstructions.version, tableName, "dropTable");
        if (!this.dialect.canInspectForeignKeys || !this.dialect.canInspectPrimaryKey)
          this.migrations.throwIfNotAllowed(this.dbInstructions.version, tableName, "continueWithoutRollback");
        changes.up += `${this.dialect.dropTable(tableName)}
`;
        changes.down += this.dialect.canInspectForeignKeys && this.dialect.canInspectPrimaryKey ? this.createTableSql(tableName, await this.dialect.getColumnInformation(tableName, this.db), await this.dialect.getForeignKeys(tableName, this.db)) : "\n\n-- Cannot recreate foreign keys or load primary keys with this database! Table will not be recreated!\n";
      }
    }
    return changes;
  }
  createTableSql(tableName, columns, foreignKeys) {
    const queryLines = [];
    for (const columnInfo of columns) {
      queryLines.push(this.dialect.columnDefinition(columnInfo.name, columnInfo.type, columnInfo.defaultValue, columnInfo.isPrimaryKey));
    }
    if (foreignKeys) {
      for (const foreignKeyInfo of foreignKeys) {
        queryLines.push(this.dialect.foreignKey(foreignKeyInfo.fromColumn, foreignKeyInfo.toTable, foreignKeyInfo.toColumn.toString(), foreignKeyInfo.onUpdate, foreignKeyInfo.onDelete));
      }
    }
    return this.dialect.createTable(tableName, queryLines);
  }
  tableDoesNotExists(tableName) {
    return this.existingTables.indexOf(tableName) == -1;
  }
  async recreateTables() {
    const changes = {
      up: "\n\n-- Recreate tables\n",
      down: "\n\n-- Recreate tables\n"
    };
    const migrationData = this.migrations.getMigrationData();
    for (const tableName in migrationData) {
      const migrationEntry = migrationData[tableName];
      if (!migrationEntry.recreate)
        continue;
      this.migrations.throwIfNotAllowed(this.dbInstructions.version, tableName, "recreateTable");
      if (!this.dialect.canInspectForeignKeys || !this.dialect.canInspectPrimaryKey)
        this.migrations.throwIfNotAllowed(this.dbInstructions.version, tableName, "continueWithoutRollback");
      const oldColumnList = await this.dialect.getColumnInformation(tableName, this.db);
      const newColumnList = this.tableStructureGenerator.tables[tableName].columns;
      const moveableColumns = newColumnList.filter((entry) => oldColumnList.find((oldEntry) => oldEntry.name == entry.name) != void 0).map((entry) => entry.name);
      const backupTableName = `${tableName}__backup`;
      const insertQuery = this.dialect.insert(
        backupTableName,
        this.dialect.insertValues(moveableColumns, this.dialect.select(tableName, moveableColumns))
      );
      const moveDataQuery = insertQuery + "\n" + this.dialect.dropTable(tableName) + "\n" + this.dialect.renameTable(backupTableName, tableName);
      const structure = this.tableStructureGenerator.tables[tableName];
      changes.up += this.createTableSql(backupTableName, structure.columns, structure.foreignKeys) + "\n" + moveDataQuery;
      changes.down += this.dialect.canInspectForeignKeys && this.dialect.canInspectPrimaryKey ? this.createTableSql(backupTableName, await this.dialect.getColumnInformation(tableName, this.db), await this.dialect.getForeignKeys(tableName, this.db)) + "\n" + moveDataQuery : "\n\n-- Cannot recreate foreign keys or load primary keys with this database! Table will not be recreated!\n";
    }
    return changes;
  }
  async migrateForeignKeys() {
    if (!this.dialect.canAlterForeignKeys)
      return { up: "", down: "" };
    let changes = {
      up: "\n\n-- Foreign keys\n",
      down: "\n\n-- Foreign keys\n"
    };
    for (const tableName in this.tableStructureGenerator.tables) {
      if (this.migrations.willBeRecreated(tableName) || this.tableDoesNotExists(tableName))
        continue;
      const structure = this.tableStructureGenerator.tables[tableName];
      const newForeignKeys = structure.foreignKeys ?? [];
      const oldForeignKeys = await this.dialect.getForeignKeys(tableName, this.db);
      let checkForNewForeignKeys = true;
      for (const oldForeignKey of oldForeignKeys) {
        const newForeignKey = newForeignKeys.find((entry) => entry.fromColumn == oldForeignKey.fromColumn);
        if (!newForeignKey) {
          Logger.log(`Foreign key ${oldForeignKey.toTable}.${oldForeignKey.toColumn} to ${oldForeignKey.toTable}.${oldForeignKey.toColumn} was removed!`);
          this.migrations.throwIfNotAllowed(this.dbInstructions.version, tableName, "removeForeignKey");
          if (this.dialect.canAlterForeignKeys) {
            changes.up += this.dialect.removeForeignKey(oldForeignKey.fromTable, oldForeignKey.fromColumn);
            changes.down += this.dialect.addForeignKey(
              oldForeignKey.fromTable,
              this.dialect.foreignKey(oldForeignKey.fromColumn, oldForeignKey.toTable, oldForeignKey.toColumn, oldForeignKey.onUpdate, oldForeignKey.onDelete)
            );
          } else {
            this.migrations.recreateTable(structure.table);
            checkForNewForeignKeys = false;
          }
        } else {
          if (!newForeignKey || oldForeignKey.toColumn != newForeignKey.toColumn || (oldForeignKey.onUpdate ?? "NO ACTION") != (newForeignKey.onUpdate ?? "NO ACTION") || (oldForeignKey.onDelete ?? "NO ACTION") != (newForeignKey.onDelete ?? "NO ACTION")) {
            Logger.log(`Foreign key ${oldForeignKey.toTable}.${oldForeignKey.toColumn} to ${oldForeignKey.toTable}.${oldForeignKey.toColumn} was changed!`);
            this.migrations.throwIfNotAllowed(this.dbInstructions.version, tableName, "alterForeignKey");
            if (this.dialect.canAlterForeignKeys) {
              changes.up += this.dialect.removeForeignKey(oldForeignKey.fromTable, oldForeignKey.fromColumn) + this.dialect.addForeignKey(
                newForeignKey.fromTable,
                this.dialect.foreignKey(newForeignKey.fromColumn, newForeignKey.toTable, newForeignKey.toColumn, newForeignKey.onUpdate, newForeignKey.onDelete)
              );
              changes.down += this.dialect.addForeignKey(
                oldForeignKey.fromTable,
                this.dialect.foreignKey(oldForeignKey.fromColumn, oldForeignKey.toTable, oldForeignKey.toColumn, oldForeignKey.onUpdate, oldForeignKey.onDelete)
              ) + this.dialect.removeForeignKey(newForeignKey.fromTable, newForeignKey.fromColumn);
            } else {
              this.migrations.recreateTable(structure.table);
              checkForNewForeignKeys = false;
            }
          }
        }
      }
      if (checkForNewForeignKeys) {
        for (const newForeignKey of newForeignKeys) {
          const oldForeignKey = oldForeignKeys.find((entry) => entry.fromColumn == newForeignKey.fromColumn);
          if (oldForeignKey)
            continue;
          Logger.log(`Foreign key ${newForeignKey.toTable}.${newForeignKey.toColumn} to ${newForeignKey.toTable}.${newForeignKey.toColumn} is new!`);
          if (this.dialect.canAlterForeignKeys) {
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
  async migrateColumns() {
    const changes = {
      up: "\n\n-- Migrate columns\n",
      down: "\n\n-- Migrate columns\n"
    };
    for (const tableName in this.tableStructureGenerator.tables) {
      if (this.migrations.willBeRecreated(tableName) || this.tableDoesNotExists(tableName))
        continue;
      const newTableDefinition = this.tableStructureGenerator.tables[tableName];
      const oldColumnList = await this.dialect.getColumnInformation(tableName, this.db);
      const oldPrimaryKey = this.dialect.canInspectPrimaryKey ? this.getPrimaryKeyColumn(oldColumnList) : false;
      const newColumnList = newTableDefinition.columns;
      const newPrimaryKey = newTableDefinition.primaryKey;
      if (this.dialect.canInspectPrimaryKey && oldPrimaryKey != newPrimaryKey) {
        Logger.log(`Primary key in ${tableName} was changed from ${oldPrimaryKey} to ${newPrimaryKey}!`);
        this.migrations.throwIfNotAllowed(this.dbInstructions.version, tableName, "alterPrimaryKey");
        if (this.dialect.canAlterPrimaryKey) {
          if (oldPrimaryKey) {
            changes.up += this.dialect.removePrimaryKey(tableName, oldPrimaryKey);
            changes.down += this.dialect.addPrimaryKey(tableName, oldPrimaryKey);
          }
          if (newPrimaryKey) {
            changes.up += this.dialect.addPrimaryKey(tableName, newPrimaryKey.toString());
            changes.down += this.dialect.removePrimaryKey(tableName, newPrimaryKey.toString());
          }
        } else
          this.migrations.recreateTable(newTableDefinition.table);
        continue;
      }
      for (const newColumn of newColumnList) {
        const oldColumn = oldColumnList.find((entry) => entry.name == newColumn.name);
        if (oldColumn == void 0) {
          changes.up += this.dialect.createColumn(tableName, this.dialect.columnDefinition(newColumn.name, newColumn.type, newColumn.defaultValue, newColumn.isPrimaryKey)) + "\n";
          changes.down += this.dialect.dropColumn(tableName, newColumn.name) + "\n";
        } else if (newColumn.type != oldColumn.type || newColumn.defaultValue != oldColumn.defaultValue) {
          this.migrations.recreateTable(newTableDefinition.table);
        }
      }
      for (const oldColumn of oldColumnList) {
        const newColumn = newColumnList.find((entry) => entry.name == oldColumn.name);
        if (newColumn == void 0) {
          this.migrations.throwIfNotAllowed(this.dbInstructions.version, tableName, "dropColumn");
          changes.up += this.dialect.dropColumn(tableName, oldColumn.name) + "\n";
          changes.down += this.dialect.createColumn(tableName, this.dialect.columnDefinition(oldColumn.name, oldColumn.type, oldColumn.defaultValue, oldColumn.isPrimaryKey)) + "\n";
        }
      }
    }
    return changes;
  }
  getPrimaryKeyColumn(columnInfoList) {
    for (const columnInfo of columnInfoList) {
      if (columnInfo.isPrimaryKey)
        return columnInfo.name;
    }
  }
  renameColumns() {
    const changes = {
      up: "\n\n-- Rename columns\n",
      down: "\n\n-- Rename columns\n"
    };
    const migrationData = this.migrations.getMigrationData();
    for (const tableName in migrationData) {
      if (migrationData[tableName].recreate)
        continue;
      this.migrations.loopRenamedColumns(tableName, (oldColumnName, newColumnName) => {
        changes.up += this.dialect.renameColumn(tableName, oldColumnName, newColumnName);
        changes.down += this.dialect.renameColumn(tableName, newColumnName, oldColumnName);
      });
    }
    return changes;
  }
};

// src/index.ts
async function prepareMigration(db, instructions, overwriteExisting) {
  Logger.setMode(instructions.loggerMode);
  const mm = new MigrationManager(db, instructions);
  await mm.prepareMigration(overwriteExisting);
}
async function runPreparedMigrations(db, instructions) {
  Logger.setMode(instructions.loggerMode);
  const migrationHistoryManager = new MigrationHistoryManager(instructions.configPath);
  const fromVersion = migrationHistoryManager.getLastHistoryVersion();
  const toVersion = instructions.version;
  if (fromVersion == toVersion)
    return;
  Logger.log(`Running migrations from ${fromVersion} to ${toVersion}`);
  for (let i = fromVersion ? fromVersion + 1 : toVersion; i <= toVersion; ++i) {
    const upChanges = migrationHistoryManager.getUpMigration(i);
    Logger.debug(upChanges);
    await db.runMultipleWriteStatements(upChanges);
    instructions.version = i;
  }
  migrationHistoryManager.setLastHistoryVersion(toVersion);
}
async function prepareAndRunMigration(db, instructions, overwriteExisting) {
  Logger.setMode(instructions.loggerMode);
  await prepareMigration(db, instructions, overwriteExisting);
  await runPreparedMigrations(db, instructions);
}
async function rollback(db, instructions, toVersion) {
  Logger.setMode(instructions.loggerMode);
  const migrationHistoryManager = new MigrationHistoryManager(instructions.configPath);
  const fromVersion = migrationHistoryManager.getLastHistoryVersion();
  Logger.log(`Rolling back from ${fromVersion} to ${toVersion}`);
  for (let i = fromVersion - 1; i >= toVersion; --i) {
    const upChanges = migrationHistoryManager.getDownMigration(i);
    Logger.debug(upChanges);
    await db.runMultipleWriteStatements(upChanges);
    instructions.version = i;
  }
  migrationHistoryManager.setLastHistoryVersion(toVersion);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  prepareAndRunMigration,
  prepareMigration,
  rollback,
  runPreparedMigrations
});
