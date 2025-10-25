export interface ColumnInfo {
	name: string
	sqlType: string
	maxLength?: number
	defaultValue?: string
	isPrimaryKey: boolean
}