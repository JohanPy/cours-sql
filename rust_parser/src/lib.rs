use wasm_bindgen::prelude::*;
use sqlparser::dialect::GenericDialect;
use sqlparser::parser::Parser;
use sqlparser::ast::{Statement, SetExpr, TableFactor, TableWithJoins, ObjectName, Select};
use std::collections::HashMap;
use serde::Serialize;

#[derive(Serialize, Default)]
pub struct ParseResult {
    pub tables: Vec<String>,
    pub aliases: HashMap<String, String>,
}

#[wasm_bindgen]
pub fn parse_sql(sql: &str) -> JsValue {
    let dialect = GenericDialect {};
    let statements = Parser::parse_sql(&dialect, sql).unwrap_or_default();

    let mut result = ParseResult::default();

    for statement in statements {
        if let Statement::Query(query) = statement {
            match query.body {
                SetExpr::Select(select) => {
                    for from in &select.from {
                        extract_from_table_with_joins(from, &mut result);
                    }
                }
                _ => {}
            }
        }
    }

    serde_wasm_bindgen::to_value(&result).unwrap()
}

fn extract_from_table_with_joins(t: &TableWithJoins, result: &mut ParseResult) {
    extract_from_table_factor(&t.relation, result);
    for join in &t.joins {
        extract_from_table_factor(&join.relation, result);
    }
}

fn extract_from_table_factor(t: &TableFactor, result: &mut ParseResult) {
    match t {
        TableFactor::Table { name, alias, .. } => {
            let table_name = name_to_string(name);
            if let Some(alias) = alias {
                result.aliases.insert(alias.name.value.clone(), table_name.clone());
            }
            if !result.tables.contains(&table_name) {
                result.tables.push(table_name);
            }
        },
        TableFactor::Derived { subquery, alias, .. } => {
            if let Some(alias) = alias {
                 result.aliases.insert(alias.name.value.clone(), String::new());
            }
            match &subquery.body {
                SetExpr::Select(select) => {
                    for from in &select.from {
                         extract_from_table_with_joins(from, result);
                    }
                }
                _ => {}
            }
        },
        _ => {}
    }
}

fn name_to_string(name: &ObjectName) -> String {
    name.0.iter().map(|i| i.value.clone()).collect::<Vec<String>>().join(".")
}
