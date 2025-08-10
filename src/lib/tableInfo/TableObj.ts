import {ForeignKeyActions} from "../typings/ForeignKeyInfo";
import {DataTypeOptions} from "./DataTypeOptions";
import {Logger} from "../Logger";
import {InputTableStructure} from "../typings/InputTableStructure";
import {InputColumnInfo} from "../typings/InputColumnInfo";

type DataFormat = Record<string, unknown>;
type GetColumns<T> = T extends TableObjBuilderDefinition<infer Item, any> ? Item : never;
type TableObjBuilderDefinition<T extends DataFormat, TPick extends keyof TableObj<T>> =  Pick<TableObj<T>, TPick>;
type NewTableObjBuilder<T extends DataFormat> = TableObjBuilderDefinition<T, "primaryKey" | "foreignKey" | "dataType" | "maxCharacterLength">;
type TableObjBuilder<T extends DataFormat> = TableObjBuilderDefinition<T, "foreignKey" | "dataType" | "maxCharacterLength">;
export type TableObjInput = TableObjBuilderDefinition<any, any>;

/**
 * Use this class to define tables for DatabaseInstructions
 * (as an alternative for Class decorators)
 *
 */
export default class TableObj<T extends DataFormat> {
	public readonly IS_TABLE_OBJ = true;
	public readonly tableName: string;
	
	public tableStructure: InputTableStructure =  {
		table: "",
		primaryKey: undefined,
		columns: {},
		foreignKeys: [],
	};
	
	
	public static getEmptyColumnEntry(key: string): InputColumnInfo {
		return {
			name: key,
			type: "",
			defaultValue: "",
			isPrimaryKey: false
		}
	}
	
	public static getColumnEntry(key: string, value: unknown): InputColumnInfo | null {
		let dataType: DataTypeOptions = typeof value as DataTypeOptions;
		switch(typeof value) {
			case "function":
				return null;
			case "object":
				if(value instanceof Date) {
					dataType = "date";
					break;
				}
				else if(value !== null) {
					Logger.warn(`${key} was skipped because its type (${typeof value}) is not supported`);
					return null;
				}
				dataType = "string";
				break;
			case "undefined":
			case "symbol":
				Logger.warn(`${key} was skipped because its type (${typeof value}) is not supported`);
				return null;
		}
		
		return {
			...TableObj.getEmptyColumnEntry(key),
			inputType: dataType,
			inputDefaultValue: value,
		}
	}
	
	private constructor(tableName: string, defaultValues: T) {
		this.tableName = tableName;
		this.tableStructure.table = tableName;
		
		for(const key in defaultValues) {
			const value = defaultValues[key as keyof T];
			const columnEntry = TableObj.getColumnEntry(key, value);
			if(!columnEntry)
				continue;
			this.tableStructure.columns[key] = columnEntry;
		}
	}
	
	public primaryKey(key: keyof T): TableObjBuilder<T>  {
		this.tableStructure.primaryKey = key.toString();
		this.tableStructure.columns[key.toString()].isPrimaryKey = true;
		return this;
	}
	public foreignKey<TOther extends TableObjBuilderDefinition<DataFormat, any>>(
		fromColumn: keyof T,
		toTable: TOther,
		toColumn: keyof GetColumns<TOther>,
		options?: {onUpdate?: ForeignKeyActions, onDelete?: ForeignKeyActions}
	): TableObjBuilder<T>  {
		this.tableStructure.foreignKeys!.push({
			fromTable: this.tableName,
			fromColumn: fromColumn.toString(),
			toTable: toTable.tableName!,
			toColumn: toColumn.toString(),
			onUpdate: options?.onUpdate,
			onDelete: options?.onDelete
		});
		return this;
	}
	public dataType(column: keyof T, type: DataTypeOptions): TableObjBuilder<T> {
		this.tableStructure.columns[column.toString()].inputType = type;
		return this;
	}
	
	public maxCharacterLength(column: keyof T, max: number): TableObjBuilder<T> {
		this.tableStructure.columns[column.toString()].maxLength = max;
		return this;
	}
	
	public static create<T extends Record<string, unknown>>(tableName: string, columns: T): NewTableObjBuilder<T> {
		return new TableObj<T>(tableName, columns);
	}
	
	public static isTableObj(obj: unknown): obj is TableObj<any> {
		return !!(obj as TableObj<any>)?.IS_TABLE_OBJ
	}
}