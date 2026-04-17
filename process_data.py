import pandas as pd
import os
import re
import json

folder = '4주기대학기관평가인증통계'
files = os.listdir(folder)
dfs = []

for f in files:
    if f.endswith('.xlsx'):
        year_match = re.search(r'(\d{4})년도', f)
        if year_match:
            year = year_match.group(1)
            filepath = os.path.join(folder, f)
            print(f"Reading {f}...")
            df = pd.read_excel(filepath)
            
            # 중복된 열 제거 (.1, .2 등 Pandas가 임의로 붙이는 중복 열 접미사 제거)
            df = df.loc[:, ~df.columns.str.contains(r'\.\d+$')]
            
            df['연도'] = year
            dfs.append(df)

if not dfs:
    print("No excel files found.")
    exit(1)

merged_df = pd.concat(dfs, ignore_index=True)

print("Reading mapping tables...")
mapping_file = '4주기대학기관평가인증지표특성.xlsx'
df_school = pd.read_excel(mapping_file, sheet_name='학교명테이블')
df_indicator = pd.read_excel(mapping_file, sheet_name='지표특성')

possible_id_vars = ['연도', '학교명', '설립구분', '지역']
id_vars = [col for col in possible_id_vars if col in merged_df.columns]
value_vars = [col for col in merged_df.columns if col not in id_vars]

print("Melting data (Wide -> Long)...")
melted_df = merged_df.melt(id_vars=id_vars, value_vars=value_vars, var_name='지표명', value_name='값')

melted_df = melted_df.dropna(subset=['값'])

# 지표특성 테이블에 존재하는 지표만 필터링
valid_indicators = set(df_indicator['지표명'].dropna())
melted_df = melted_df[melted_df['지표명'].isin(valid_indicators)]

print("Joining mapping data...")
# 학교명 통합
melted_df = melted_df.merge(df_school[['학교명', '현재 학교명']], on='학교명', how='left')
melted_df['학교명'] = melted_df['현재 학교명'].fillna(melted_df['학교명'])
melted_df = melted_df.drop(columns=['현재 학교명'])

# 지표특성 병합
melted_df = melted_df.merge(df_indicator, on='지표명', how='left')

import numpy as np

print("Exporting to JSON...")
records = json.loads(melted_df.to_json(orient='records', force_ascii=False))

data_payload = {
    'records': records,
    'filters': {
        'years': sorted(list(set(r['연도'] for r in records if r.get('연도')))),
        'schools': sorted(list(set(r['학교명'] for r in records if r.get('학교명')))),
        'indicators': sorted(list(set(r['지표명'] for r in records if r.get('지표명')))),
        'regions': sorted(list(set(r.get('지역') for r in records if r.get('지역')))),
        'types': sorted(list(set(r.get('설립구분') for r in records if r.get('설립구분'))))
    },
    'indicator_metadata': json.loads(df_indicator.to_json(orient='records', force_ascii=False))
}

with open('dashboard_data.json', 'w', encoding='utf-8') as f:
    json.dump(data_payload, f, ensure_ascii=False)

print("Done! Saved dashboard_data.json")
