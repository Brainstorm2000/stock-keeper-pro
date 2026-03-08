/**
 * Parses database errors and returns user-friendly messages
 */

interface ParsedError {
  title: string;
  description: string;
}

export function parseDbError(error: Error, context: string): ParsedError {
  const message = error.message?.toLowerCase() || '';
  
  // Foreign key constraint violations
  if (message.includes('violates foreign key constraint')) {
    if (message.includes('products_unit_id_fkey')) {
      return {
        title: `Cannot delete ${context}`,
        description: 'This unit is being used by one or more products. Remove or reassign those products first.',
      };
    }
    if (message.includes('products_branch_id_fkey')) {
      return {
        title: `Cannot delete ${context}`,
        description: 'This branch has products assigned to it. Remove or reassign those products first.',
      };
    }
    if (message.includes('stock_history_product_id_fkey')) {
      return {
        title: `Cannot delete ${context}`,
        description: 'This product has stock history records. Consider archiving it instead.',
      };
    }
    if (message.includes('user_branch_assignments_branch_id_fkey')) {
      return {
        title: `Cannot delete ${context}`,
        description: 'This branch has users assigned to it. Remove user assignments first.',
      };
    }
    return {
      title: `Cannot delete ${context}`,
      description: 'This item is being referenced by other records. Remove those references first.',
    };
  }
  
  // Unique constraint violations
  if (message.includes('duplicate key') || message.includes('unique constraint')) {
    if (message.includes('organizations_slug_key')) {
      return {
        title: 'Organization code already exists',
        description: 'Please choose a different organization code. This one is already in use.',
      };
    }
    if (message.includes('units_name') || message.includes('unit')) {
      return {
        title: 'Unit already exists',
        description: 'A unit with this name already exists in your organization.',
      };
    }
    if (message.includes('branches_name') || message.includes('branch')) {
      return {
        title: 'Branch already exists',
        description: 'A branch with this name already exists in your organization.',
      };
    }
    if (message.includes('products_sku')) {
      return {
        title: 'SKU already exists',
        description: 'A product with this SKU already exists. Please use a unique SKU.',
      };
    }
    if (message.includes('profiles_user_id')) {
      return {
        title: 'Profile already exists',
        description: 'A profile for this user already exists.',
      };
    }
    if (message.includes('user_roles_user_id')) {
      return {
        title: 'User role already assigned',
        description: 'This user already has a role assigned in this organization.',
      };
    }
    if (message.includes('user_branch_assignments')) {
      return {
        title: 'Already assigned',
        description: 'This user is already assigned to this branch.',
      };
    }
    return {
      title: `${context} already exists`,
      description: 'An item with these details already exists. Please use unique values.',
    };
  }
  
  // Row-level security policy violations
  if (message.includes('row-level security') || message.includes('rls')) {
    return {
      title: 'Subscription Expired',
      description:
        "Your organization's subscription has expired. Please contact the developer to renew your subscription in order to continue using the system.",
    };
  }
  
  // Not null violations
  if (message.includes('null value') || message.includes('not-null constraint')) {
    return {
      title: 'Missing required field',
      description: 'Please fill in all required fields and try again.',
    };
  }
  
  // Check constraint violations
  if (message.includes('check constraint')) {
    if (message.includes('stock') || message.includes('quantity')) {
      return {
        title: 'Invalid stock value',
        description: 'Stock values must be zero or greater.',
      };
    }
    return {
      title: 'Invalid value',
      description: 'One or more values are outside the allowed range.',
    };
  }
  
  // Network / connection errors
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return {
      title: 'Connection error',
      description: 'Unable to connect to the server. Please check your internet connection and try again.',
    };
  }
  
  // Timeout errors
  if (message.includes('timeout')) {
    return {
      title: 'Request timeout',
      description: 'The request took too long. Please try again.',
    };
  }
  
  // No rows returned when expected
  if (message.includes('pgrst116') || message.includes('no rows')) {
    return {
      title: `${context} not found`,
      description: 'The requested item could not be found. It may have been deleted.',
    };
  }
  
  // Authentication errors
  if (message.includes('jwt') || message.includes('token') || message.includes('auth')) {
    return {
      title: 'Session expired',
      description: 'Your session has expired. Please sign in again.',
    };
  }

  // Default fallback - don't show raw error message
  return {
    title: `Failed to ${context.toLowerCase()}`,
    description: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
  };
}
