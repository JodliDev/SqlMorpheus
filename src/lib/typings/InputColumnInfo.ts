import {ColumnInfo} from "./ColumnInfo";
import {DataTypeOptions} from "../tableInfo/DataTypeOptions";

export interface InputColumnInfo extends ColumnInfo {
	inputType?: DataTypeOptions
	inputDefaultValue?: unknown
}