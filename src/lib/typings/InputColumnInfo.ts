import {ColumnInfo} from "./ColumnInfo.ts";
import {DataTypeOptions} from "../tableInfo/DataTypeOptions.ts";

export interface InputColumnInfo extends ColumnInfo {
	inputType?: DataTypeOptions
	inputDefaultValue?: unknown
}