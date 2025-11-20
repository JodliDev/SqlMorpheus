import {InputColumnInfo} from "../typings/InputColumnInfo";
import {DataTypeOptions} from "./DataTypeOptions";
import {Logger} from "../Logger";
import TableObj from "./TableObj";

export type AllowedTypes = boolean | number | bigint | string | null | Date;

export class TableObjHelper {
	public static isTableObj(obj: unknown): obj is TableObj<any> {
		return !!(obj as TableObj<any>)?.IS_TABLE_OBJ
	}
	
	public static getEmptyColumnEntry(key: string): InputColumnInfo {
		return {
			name: key,
			sqlType: "",
			defaultValue: "",
			isPrimaryKey: false
		}
	}
	
	public static getColumnEntry(key: string, value: AllowedTypes): InputColumnInfo | null {
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
			...TableObjHelper.getEmptyColumnEntry(key),
			inputType: dataType,
			inputDefaultValue: value,
		}
	}
}