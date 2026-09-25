import { serve } from './_lib/http.js'
import { getProgress, putProgress } from './_lib/handlers.js'

export const GET = serve(getProgress)
export const PUT = serve(putProgress)
