import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify caller is super_super_admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify with anon client first
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller } } = await anonClient.auth.getUser()
    if (!caller) throw new Error('Unauthorized')

    // Check super_super_admin role
    const { data: roleCheck } = await anonClient.rpc('is_super_super_admin', { _user_id: caller.id })
    if (!roleCheck) throw new Error('Forbidden: super_super_admin only')

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { action, ...params } = await req.json()

    switch (action) {
      case 'create_user': {
        const { email, password, full_name, organization_id, role } = params
        const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        })
        if (createError) throw createError

        const userId = userData.user.id

        // Create profile
        await adminClient.from('profiles').insert({
          user_id: userId,
          email,
          full_name: full_name || null,
          organization_id: organization_id || null,
          is_active: true,
        })

        // Create role
        await adminClient.from('user_roles').insert({
          user_id: userId,
          role: role || 'user',
          organization_id: organization_id || null,
        })

        return new Response(JSON.stringify({ success: true, user_id: userId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'update_user': {
        const { user_id, full_name, email, organization_id, role, is_active } = params

        // Update profile
        const profileUpdate: Record<string, any> = {}
        if (full_name !== undefined) profileUpdate.full_name = full_name
        if (email !== undefined) profileUpdate.email = email
        if (organization_id !== undefined) profileUpdate.organization_id = organization_id
        if (is_active !== undefined) profileUpdate.is_active = is_active

        if (Object.keys(profileUpdate).length > 0) {
          await adminClient.from('profiles').update(profileUpdate).eq('user_id', user_id)
        }

        // Update auth email if changed
        if (email !== undefined) {
          await adminClient.auth.admin.updateUserById(user_id, { email })
        }

        // Update role if provided
        if (role !== undefined) {
          await adminClient.from('user_roles')
            .update({ role, organization_id: organization_id ?? null })
            .eq('user_id', user_id)
        } else if (organization_id !== undefined) {
          // Just update org on role record
          await adminClient.from('user_roles')
            .update({ organization_id })
            .eq('user_id', user_id)
        }

        // If deactivating, ban user in auth; if activating, unban
        if (is_active !== undefined) {
          await adminClient.auth.admin.updateUserById(user_id, {
            ban_duration: is_active ? 'none' : '876000h', // ~100 years
          })
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'delete_user': {
        const { user_id } = params
        
        // Delete profile and role (cascade should handle related data)
        await adminClient.from('user_roles').delete().eq('user_id', user_id)
        await adminClient.from('profiles').delete().eq('user_id', user_id)
        await adminClient.auth.admin.deleteUser(user_id)

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'list_all_users': {
        // Get all profiles with roles
        const { data: profiles, error: pErr } = await adminClient
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })

        if (pErr) throw pErr

        const { data: roles, error: rErr } = await adminClient
          .from('user_roles')
          .select('*')

        if (rErr) throw rErr

        const users = (profiles || []).map((p: any) => {
          const userRole = (roles || []).find((r: any) => r.user_id === p.user_id)
          return {
            ...p,
            role: userRole?.role || 'user',
            role_organization_id: userRole?.organization_id,
          }
        })

        return new Response(JSON.stringify({ users }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
