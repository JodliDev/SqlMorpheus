import TableInfo from "./TableInfo";
import {ForeignKeyActions, ForeignKeyInfo} from "../typings/ForeignKeyInfo";
import {DataTypeOptions} from "./DataTypeOptions";

type DataFormat = Record<string, unknown>;
type GetColumns<T> = T extends TableObjBuilder<infer Item, any> ? Item : never;
type TableObjBuilder<T extends DataFormat, TPick extends keyof TableObj<T>> =  Pick<TableObj<T>, TPick>;
export type TableObjInput = TableObjBuilder<any, any>;

export class TableObj<T extends DataFormat> {
	public readonly IS_TABLE_OBJ = true;
	public readonly tableName: string;
	public readonly columns: T;
	
	public tableInfo: TableInfo =  {
		primaryKey: undefined as undefined | string,
		foreignKeys: [] as ForeignKeyInfo[],
		dataTypes: {}
	};
	
	constructor(tableName: string, columns: T) {
		this.tableName = tableName;
		this.columns = columns;
	}
	public primaryKey(key: keyof T): TableObjBuilder<T, "foreignKey" | "dataType">  {
		this.tableInfo.primaryKey = key.toString();
		
		return this;
	}
	public foreignKey<TOther extends TableObjBuilder<DataFormat, any>>(fromColumn: keyof T, toTable: TOther, toColumn: keyof GetColumns<TOther>, options?: {onUpdate?: ForeignKeyActions, onDelete?: ForeignKeyActions}): TableObjBuilder<T, "foreignKey" | "dataType">  {
		this.tableInfo.foreignKeys!.push({
			fromTable: this.tableName,
			fromColumn: fromColumn.toString(),
			toTable: toTable.tableName!,
			toColumn: toColumn.toString(),
			onUpdate: options?.onUpdate,
			onDelete: options?.onDelete
		});
		return this;
	}
	public dataType(column: keyof T, type: DataTypeOptions): TableObjBuilder<T, "foreignKey" | "dataType"> {
		this.tableInfo.dataTypes![column.toString()] = type;
		return this;
	}
	
	public static create<T extends Record<string, unknown>>(tableName: string, columns: T): TableObjBuilder<T, "primaryKey" | "foreignKey" | "dataType"> {
		return new TableObj<T>(tableName, columns);
	}
	
	public static isDbTable(obj: unknown): obj is TableObj<any> {
		return (obj as TableObj<any>).IS_TABLE_OBJ
	}
}