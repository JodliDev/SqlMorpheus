import DefaultSql from "./DefaultSql";
import {ColumnInfo} from "../typings/ColumnInfo";
import {ForeignKeyActions, ForeignKeyInfo} from "../typings/ForeignKeyInfo";

export default class PostgresDialect extends DefaultSql {
	public canRecreateTable: boolean = false;
	public canAlterColumnStructure: boolean = true;
	public canAlterForeignKeys: boolean = true;
	public canAlterPrimaryKey: boolean = true;
	
	public types = {
		text: "TEXT",
		string: "VARCHAR",
		number: "NUMERIC",
		bigint: "BIGINT",
		boolean: "BOOLEAN",
		date: "DATE",
		time: "TIME",
		dateTime: "TIMESTAMP",
	};
	
	public formatIdentifier(identifier: string): string {
		return `"${identifier}"`;
	}
	public alterColumnStructure(tableName: string, columnName: string, sqlType: string, defaultValue?: string): string {
		return`ALTER TABLE ${tableName} ALTER COLUMN ${columnName} TYPE ${sqlType}; ALTER TABLE ${tableName} ALTER COLUMN ${columnName} ${defaultValue ? `SET DEFAULT ${defaultValue}` : "DROP DEFAULT"};`;
	}
	public async runTransactionWithoutForeignKeys(query: string): Promise<void> {
		await this.db.runTransaction(`SET session_replication_role = 'replica'; ${query}; SET session_replication_role = 'origin';`);
	}
	public addForeignKey(fromTableName: string, foreignKey: string): string {
		return `ALTER TABLE ${this.formatIdentifier(fromTableName)} ADD CONSTRAINT ${this.formatIdentifier(fromTableName)} ${foreignKey};`;
	}
	public removeForeignKey(tableName: string, foreignKeyName: string): string {
		return `ALTER TABLE ${this.formatIdentifier(tableName)} DROP CONSTRAINT ${foreignKeyName};`;
	}
	
	public async getTableNames(): Promise<string[]> {
		const result = await this.db.runReadStatement("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';") as {table_name: string}[];
		return result.map(row => row.table_name);
	}
	
	public async getColumnInformation(tableName: string): Promise<Record<string, ColumnInfo>> {
		const data = await this.db.runReadStatement(`SELECT c.column_name as column_name, data_type, column_default, constraint_type FROM information_schema.columns c LEFT JOIN information_schema.key_column_usage cu ON cu.table_name = c.table_name AND cu.column_name = c.column_name LEFT JOIN information_schema.table_constraints tc ON tc.constraint_name = cu.constraint_name WHERE c.table_schema = 'public' AND c.table_name = '${tableName}';`);
		
		
		const output: Record<string, ColumnInfo> = {};
		for(const entry of data as Record<string, string>[]) {
			const defaultValue = entry["column_default"]?.match(/^'(.+)'::.+$/);
			
			let dataType = entry["data_type"].toUpperCase();
			switch(dataType) {
				case "INTEGER":
					dataType = this.types.number;
					break;
				case "CHARACTER VARYING":
					dataType = this.types.string;
					break;
				case "TIMESTAMP WITHOUT TIME ZONE":
				case "TIMESTAMP WITH TIME ZONE":
					dataType = this.types.dateTime;
					break;
				case "TIME WITHOUT TIME ZONE":
				case "TIME WITH TIME ZONE":
					dataType = this.types.time;
					break;
				case "DATE WITHOUT TIME ZONE":
				case "DATE WITH TIME ZONE":
					dataType = this.types.date;
					break;
			}
			output[entry["column_name"]] = {
				name: entry["column_name"],
				sqlType: dataType,
				defaultValue: defaultValue ? `'${defaultValue[1]}'` : (entry["column_default"] ?? this.nullType),
				isPrimaryKey: entry["constraint_type"] == "PRIMARY KEY",
			}
		}
		return output;
	}
	
	public addPrimaryKey(tableName: string, columnName: string): string {
		return `ALTER TABLE ${tableName} ADD PRIMARY KEY (${columnName});\n`;
	}
	public removePrimaryKey(tableName: string, columnName: string): string {
		return `ALTER TABLE ${tableName} DROP CONSTRAINT ${columnName};\n`;
	}
	
	
	public async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
		const data = await this.db.runReadStatement(`SELECT
				tc.table_name AS child_table,
				kcu.column_name AS child_column,
                ccu.table_name AS parent_table,
				ccu.column_name AS parent_column,
				rc.update_rule AS update_rule,
				rc.delete_rule AS delete_rule
			FROM information_schema.table_constraints AS tc
				JOIN information_schema.key_column_usage AS kcu
					ON tc.constraint_name = kcu.constraint_name
				JOIN information_schema.constraint_column_usage AS ccu
					ON tc.constraint_name = ccu.constraint_name
                JOIN information_schema.referential_constraints AS rc
                     ON tc.constraint_name=rc.constraint_name
			WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = '${tableName}';`
		);
		
		return (data as Record<string, string>[]).map(entry => {
			return {
				fromTable: tableName,
				fromColumn: entry["child_column"],
				toTable: entry["parent_table"],
				toColumn: entry["parent_column"],
				onUpdate: entry["update_rule"] as ForeignKeyActions,
				onDelete: entry["delete_rule"] as ForeignKeyActions
			}
		});
	}
}