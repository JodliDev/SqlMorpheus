import {ForeignKeyActions} from "../typings/ForeignKeyInfo";
import {DataTypeOptions} from "./DataTypeOptions";
import {InputTableStructure} from "../typings/InputTableStructure";
import {InputColumnInfo} from "../typings/InputColumnInfo";
import {AllowedTypes, TableObjHelper} from "./TableObjHelper";

interface ColumnOptions {
	primaryKey?: boolean;
	dataType?: DataTypeOptions;
	maxCharacterLength?: number;
}
type DataFormat = Record<string, AllowedTypes | [AllowedTypes, ColumnOptions]>;
type GetColumns<T> = T extends PublicTableObj<infer Item> ? Item : never;
type PublicTableObj<T extends DataFormat> = Pick<TableObj<T>, "foreignKey" | "sealType">;
export type TableObjInput = PublicTableObj<DataFormat>;

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
	
	private constructor(tableName: string, defaultValues: T) {
		const addColumnEntry = (key: string, value: AllowedTypes) => {
			const columnEntry = TableObjHelper.getColumnEntry(key, value);
			if(!columnEntry) {
				return
			}
			this.tableStructure.columns[key] = columnEntry;
			return columnEntry;
		}
		this.tableName = tableName;
		this.tableStructure.table = tableName;
		
		for(const key in defaultValues) {
			const content = defaultValues[key as keyof T];
			if(Array.isArray(content)) {
				const [value, options] = content;
				const columnEntry = addColumnEntry(key, value);
				
				if(columnEntry) {
					this.applyOptions(columnEntry, options);
				}
			}
			else {
				addColumnEntry(key, content);
			}
		}
	}
	private applyOptions(entry: InputColumnInfo, options: ColumnOptions) {
		for(const keyString in options) {
			const key = keyString as keyof ColumnOptions
			switch(key) {
				case "primaryKey":
					if(this.tableStructure.primaryKey) {
						this.tableStructure.columns[this.tableStructure.primaryKey].isPrimaryKey = false;
					}
					this.tableStructure.primaryKey = entry.name;
					entry.isPrimaryKey = true;
					break;
				case "dataType":
					entry.inputType = options[key];
					break;
				case "maxCharacterLength":
					entry.maxLength = options[key];
					break;
				default:
					throw new Error(`Unsupported option "${key}" for ${this.tableName}.${entry.name}`);
			}
		}
	}
	
	/**
	 * Creates a foreign key relationship between the current table and a target table.
	 *
	 * @param fromColumn - The column in the current table that will serve as the foreign key.
	 * @param toTable - The target table object that the foreign key will reference.
	 * @param toColumn - The column in the target table that the foreign key will reference.
	 * @param options - Optional configurations for the foreign key, specifying actions on update or delete.
	 */
	public foreignKey<TOther extends Partial<TableObj<DataFormat>>>(
		fromColumn: keyof T,
		toTable: TOther,
		toColumn: keyof GetColumns<TOther>,
		options?: {onUpdate?: ForeignKeyActions, onDelete?: ForeignKeyActions}
	): PublicTableObj<T>  {
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
	
	/**
	 * An optional helper function to deal with `TS2589: Type instantiation is excessively deep and possibly infinite. when used as method parameter`
	 * Does nothing in runtime
	 */
	public sealType(): TableObjInput {
		return this;
	}
	
	public static create<T extends DataFormat>(tableName: string, columns: T): PublicTableObj<T> {
		return new TableObj<T>(tableName, columns);
	}
}