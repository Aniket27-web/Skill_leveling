// Remove legacy browser-stored credentials left by earlier builds.
export function clearAISettings() {
  sessionStorage.removeItem('mock_interview_llm_provider');
  sessionStorage.removeItem('mock_interview_llm_api_key');
}
