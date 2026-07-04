import { useCollection } from './useCollection'

// Priority order for billing commission calculation:
// 1. Staff-specific override for that exact service
// 2. Staff-specific override for that service's category
// 3. Per-service commission (set on the service doc itself)
// 4. Category default rule
// 5. 0
export function useCommissionRules() {
  const { docs: rules, loading } = useCollection('commissionRules')
  return { rules, loading }
}

function applyRate(type, value, price) {
  if (!type || type === 'none') return 0
  if (type === 'percentage') return Math.round((price * value) / 100)
  return value // fixed
}

export function calcServiceCommission(service, staffId, rules) {
  if (!service) return 0
  const price = service.price ?? 0

  // 1. Staff-service override
  if (staffId) {
    const staffSvcRule = rules.find(
      (r) => r.type === 'staff-override' &&
             r.staffId === staffId &&
             r.scope === 'service' &&
             r.serviceName === service.name
    )
    if (staffSvcRule) return applyRate(staffSvcRule.commissionType, staffSvcRule.commissionValue, price)

    // 2. Staff-category override
    const staffCatRule = rules.find(
      (r) => r.type === 'staff-override' &&
             r.staffId === staffId &&
             r.scope === 'category' &&
             r.category === service.category
    )
    if (staffCatRule) return applyRate(staffCatRule.commissionType, staffCatRule.commissionValue, price)
  }

  // 3. Per-service commission (from service doc)
  if (service.commissionType && service.commissionType !== 'none') {
    return applyRate(service.commissionType, service.commissionValue ?? 0, price)
  }

  // 4. Category default
  const catRule = rules.find(
    (r) => r.type === 'category' && r.category === service.category
  )
  if (catRule) return applyRate(catRule.commissionType, catRule.commissionValue, price)

  return 0
}

export function calcTotalCommission(services, staffId, rules) {
  return services.reduce((sum, svc) => sum + calcServiceCommission(svc, staffId, rules), 0)
}
