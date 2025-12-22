export const tools = [
  {
    name: 'execute_sql',
    description: `Execute a SQL query against the WHD enforcement database. Use this to answer questions about wage violations, investigations, employers, and back wages. 
    
IMPORTANT GUIDELINES:
- Only use SELECT queries - no INSERT, UPDATE, or DELETE
- ALWAYS use LIMIT clause (e.g., TOP 10, TOP 20) to avoid retrieving too much data
- Only SELECT columns that are relevant to answering the question - avoid SELECT *
- Use aggregate functions (COUNT, SUM, AVG) when appropriate
- Results are automatically limited to 100 rows maximum

Example queries:
- SELECT TOP 10 legal_name, h1b_violtn_cnt FROM whd_whisard WHERE h1b_violtn_cnt > 0 ORDER BY h1b_violtn_cnt DESC
- SELECT COUNT(*) as total_cases FROM whd_whisard
- SELECT st_cd, SUM(bw_atp_amt) as total_back_wages FROM whd_whisard GROUP BY st_cd ORDER BY total_back_wages DESC`,
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The SQL SELECT query to execute. Must include TOP N or LIMIT clause for queries returning multiple rows.'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_table_schema',
    description: 'Get the schema/structure of the whd_whisard table to understand available columns',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];