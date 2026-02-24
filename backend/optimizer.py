from pulp import LpMinimize, LpProblem, LpVariable, lpSum, value, LpStatus

# Resource demand per severity level
DEMAND_MAP = {
    'Low':    {'food_kits': 500,   'medical_units': 20,  'shelters': 100},
    'Medium': {'food_kits': 3000,  'medical_units': 120, 'shelters': 800},
    'High':   {'food_kits': 15000, 'medical_units': 500, 'shelters': 5000},
}

# Unit costs (USD)
COSTS = {
    'food_kits':     10,
    'medical_units': 200,
    'shelters':      500,
}

def optimize_resources(severity_level: str, available_budget: float) -> dict:
    """
    Linear programming optimizer.
    Minimize cost while meeting minimum demand and staying within budget.
    Returns resource plan and total cost.
    """
    if severity_level not in DEMAND_MAP:
        raise ValueError(f"Invalid severity level: {severity_level}. Choose Low / Medium / High.")

    demand = DEMAND_MAP[severity_level]

    # Define LP problem
    prob = LpProblem("DisasterResourceAllocation", LpMinimize)

    # Decision variables (integer, >= demand)
    food    = LpVariable("food_kits",     lowBound=demand['food_kits'],     cat='Integer')
    medical = LpVariable("medical_units", lowBound=demand['medical_units'], cat='Integer')
    shelter = LpVariable("shelters",      lowBound=demand['shelters'],      cat='Integer')

    # Objective: minimize total cost
    total_cost_expr = (
        COSTS['food_kits']     * food +
        COSTS['medical_units'] * medical +
        COSTS['shelters']      * shelter
    )
    prob += total_cost_expr

    # Budget constraint
    prob += total_cost_expr <= available_budget

    # Solve
    prob.solve()

    status = LpStatus[prob.status]

    if status != 'Optimal':
        # Budget too low — return minimum required plan with actual cost
        min_cost = (
            demand['food_kits']     * COSTS['food_kits'] +
            demand['medical_units'] * COSTS['medical_units'] +
            demand['shelters']      * COSTS['shelters']
        )
        return {
            "status": "Budget insufficient — returning minimum required plan",
            "resource_plan": demand,
            "total_cost": min_cost,
            "budget_shortfall": round(min_cost - available_budget, 2)
        }

    resource_plan = {
        'food_kits':     int(value(food)),
        'medical_units': int(value(medical)),
        'shelters':      int(value(shelter)),
    }
    total_cost = round(value(total_cost_expr), 2)

    return {
        "status": "Optimal",
        "resource_plan": resource_plan,
        "total_cost": total_cost,
        "budget_remaining": round(available_budget - total_cost, 2)
    }