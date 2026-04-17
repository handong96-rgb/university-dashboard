import pandas as pd
import json

data = {}

df1 = pd.read_excel('4주기대학기관평가인증지표특성.xlsx', sheet_name='지표특성')
data['지표특성_columns'] = list(df1.columns)
data['지표특성_head'] = df1.head(2).to_dict(orient='records')

df2 = pd.read_excel('4주기대학기관평가인증지표특성.xlsx', sheet_name='학교명테이블')
data['학교명테이블_columns'] = list(df2.columns)
data['학교명테이블_head'] = df2.head(2).to_dict(orient='records')

df3 = pd.read_excel('4주기대학기관평가인증통계/4주기 2025년도 대학현황지표 - 20260414182755.xlsx')
data['2025년도_columns'] = list(df3.columns)
data['2025년도_head'] = df3.head(2).to_dict(orient='records')

with open('explore.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
