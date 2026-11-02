import {TableStructure} from "./TableStructure.ts";
import {InputColumnInfo} from "./InputColumnInfo.ts";
import {InputIndexInfo} from "./IndexInfo.ts";

export interface InputTableStructure extends Omit<TableStructure, "indexes"> {
	columns: Record<string, InputColumnInfo>
	indexes?: InputIndexInfo[]
}