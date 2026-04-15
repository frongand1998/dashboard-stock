export type Dict = Record<string, string>;

export type GroupedDictionary = {
  [key: string]: string | GroupedDictionary;
};

export type InterpolateVars = Record<string, string | number>;
