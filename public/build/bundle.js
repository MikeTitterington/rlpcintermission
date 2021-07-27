
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function is_promise(value) {
        return value && typeof value === 'object' && typeof value.then === 'function';
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    // Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
    // at the end of hydration without touching the remaining nodes.
    let is_hydrating = false;
    function start_hydrating() {
        is_hydrating = true;
    }
    function end_hydrating() {
        is_hydrating = false;
    }
    function upper_bound(low, high, key, value) {
        // Return first index of value larger than input value in the range [low, high)
        while (low < high) {
            const mid = low + ((high - low) >> 1);
            if (key(mid) <= value) {
                low = mid + 1;
            }
            else {
                high = mid;
            }
        }
        return low;
    }
    function init_hydrate(target) {
        if (target.hydrate_init)
            return;
        target.hydrate_init = true;
        // We know that all children have claim_order values since the unclaimed have been detached
        const children = target.childNodes;
        /*
        * Reorder claimed children optimally.
        * We can reorder claimed children optimally by finding the longest subsequence of
        * nodes that are already claimed in order and only moving the rest. The longest
        * subsequence subsequence of nodes that are claimed in order can be found by
        * computing the longest increasing subsequence of .claim_order values.
        *
        * This algorithm is optimal in generating the least amount of reorder operations
        * possible.
        *
        * Proof:
        * We know that, given a set of reordering operations, the nodes that do not move
        * always form an increasing subsequence, since they do not move among each other
        * meaning that they must be already ordered among each other. Thus, the maximal
        * set of nodes that do not move form a longest increasing subsequence.
        */
        // Compute longest increasing subsequence
        // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
        const m = new Int32Array(children.length + 1);
        // Predecessor indices + 1
        const p = new Int32Array(children.length);
        m[0] = -1;
        let longest = 0;
        for (let i = 0; i < children.length; i++) {
            const current = children[i].claim_order;
            // Find the largest subsequence length such that it ends in a value less than our current value
            // upper_bound returns first greater value, so we subtract one
            const seqLen = upper_bound(1, longest + 1, idx => children[m[idx]].claim_order, current) - 1;
            p[i] = m[seqLen] + 1;
            const newLen = seqLen + 1;
            // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
            m[newLen] = i;
            longest = Math.max(newLen, longest);
        }
        // The longest increasing subsequence of nodes (initially reversed)
        const lis = [];
        // The rest of the nodes, nodes that will be moved
        const toMove = [];
        let last = children.length - 1;
        for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
            lis.push(children[cur - 1]);
            for (; last >= cur; last--) {
                toMove.push(children[last]);
            }
            last--;
        }
        for (; last >= 0; last--) {
            toMove.push(children[last]);
        }
        lis.reverse();
        // We sort the nodes being moved to guarantee that their insertion order matches the claim order
        toMove.sort((a, b) => a.claim_order - b.claim_order);
        // Finally, we move the nodes
        for (let i = 0, j = 0; i < toMove.length; i++) {
            while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
                j++;
            }
            const anchor = j < lis.length ? lis[j] : null;
            target.insertBefore(toMove[i], anchor);
        }
    }
    function append(target, node) {
        if (is_hydrating) {
            init_hydrate(target);
            if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentElement !== target))) {
                target.actual_end_child = target.firstChild;
            }
            if (node !== target.actual_end_child) {
                target.insertBefore(node, target.actual_end_child);
            }
            else {
                target.actual_end_child = node.nextSibling;
            }
        }
        else if (node.parentNode !== target) {
            target.appendChild(node);
        }
    }
    function insert(target, node, anchor) {
        if (is_hydrating && !anchor) {
            append(target, node);
        }
        else if (node.parentNode !== target || (anchor && node.nextSibling !== anchor)) {
            target.insertBefore(node, anchor || null);
        }
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }
    class HtmlTag {
        constructor(claimed_nodes) {
            this.e = this.n = null;
            this.l = claimed_nodes;
        }
        m(html, target, anchor = null) {
            if (!this.e) {
                this.e = element(target.nodeName);
                this.t = target;
                if (this.l) {
                    this.n = this.l;
                }
                else {
                    this.h(html);
                }
            }
            this.i(anchor);
        }
        h(html) {
            this.e.innerHTML = html;
            this.n = Array.from(this.e.childNodes);
        }
        i(anchor) {
            for (let i = 0; i < this.n.length; i += 1) {
                insert(this.t, this.n[i], anchor);
            }
        }
        p(html) {
            this.d();
            this.h(html);
            this.i(this.a);
        }
        d() {
            this.n.forEach(detach);
        }
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    function handle_promise(promise, info) {
        const token = info.token = {};
        function update(type, index, key, value) {
            if (info.token !== token)
                return;
            info.resolved = value;
            let child_ctx = info.ctx;
            if (key !== undefined) {
                child_ctx = child_ctx.slice();
                child_ctx[key] = value;
            }
            const block = type && (info.current = type)(child_ctx);
            let needs_flush = false;
            if (info.block) {
                if (info.blocks) {
                    info.blocks.forEach((block, i) => {
                        if (i !== index && block) {
                            group_outros();
                            transition_out(block, 1, 1, () => {
                                if (info.blocks[i] === block) {
                                    info.blocks[i] = null;
                                }
                            });
                            check_outros();
                        }
                    });
                }
                else {
                    info.block.d(1);
                }
                block.c();
                transition_in(block, 1);
                block.m(info.mount(), info.anchor);
                needs_flush = true;
            }
            info.block = block;
            if (info.blocks)
                info.blocks[index] = block;
            if (needs_flush) {
                flush();
            }
        }
        if (is_promise(promise)) {
            const current_component = get_current_component();
            promise.then(value => {
                set_current_component(current_component);
                update(info.then, 1, info.value, value);
                set_current_component(null);
            }, error => {
                set_current_component(current_component);
                update(info.catch, 2, info.error, error);
                set_current_component(null);
                if (!info.hasCatch) {
                    throw error;
                }
            });
            // if we previously had a then/catch block, destroy it
            if (info.current !== info.pending) {
                update(info.pending, 0);
                return true;
            }
        }
        else {
            if (info.current !== info.then) {
                update(info.then, 1, info.value, promise);
                return true;
            }
            info.resolved = promise;
        }
    }
    function update_await_block_branch(info, ctx, dirty) {
        const child_ctx = ctx.slice();
        const { resolved } = info;
        if (info.current === info.then) {
            child_ctx[info.value] = resolved;
        }
        if (info.current === info.catch) {
            child_ctx[info.error] = resolved;
        }
        info.block.p(child_ctx, dirty);
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error('Cannot have duplicate keys in a keyed each');
            }
            keys.add(key);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                start_hydrating();
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            end_hydrating();
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.38.3' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fade(node, { delay = 0, duration = 400, easing = identity } = {}) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }
    function slide(node, { delay = 0, duration = 400, easing = cubicOut } = {}) {
        const style = getComputedStyle(node);
        const opacity = +style.opacity;
        const height = parseFloat(style.height);
        const padding_top = parseFloat(style.paddingTop);
        const padding_bottom = parseFloat(style.paddingBottom);
        const margin_top = parseFloat(style.marginTop);
        const margin_bottom = parseFloat(style.marginBottom);
        const border_top_width = parseFloat(style.borderTopWidth);
        const border_bottom_width = parseFloat(style.borderBottomWidth);
        return {
            delay,
            duration,
            easing,
            css: t => 'overflow: hidden;' +
                `opacity: ${Math.min(t * 20, 1) * opacity};` +
                `height: ${t * height}px;` +
                `padding-top: ${t * padding_top}px;` +
                `padding-bottom: ${t * padding_bottom}px;` +
                `margin-top: ${t * margin_top}px;` +
                `margin-bottom: ${t * margin_bottom}px;` +
                `border-top-width: ${t * border_top_width}px;` +
                `border-bottom-width: ${t * border_bottom_width}px;`
        };
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function createCommonjsModule(fn) {
      var module = { exports: {} };
    	return fn(module, module.exports), module.exports;
    }

    /*!
     * jQuery JavaScript Library v3.6.0
     * https://jquery.com/
     *
     * Includes Sizzle.js
     * https://sizzlejs.com/
     *
     * Copyright OpenJS Foundation and other contributors
     * Released under the MIT license
     * https://jquery.org/license
     *
     * Date: 2021-03-02T17:08Z
     */

    createCommonjsModule(function (module) {
    ( function( global, factory ) {

    	{

    		// For CommonJS and CommonJS-like environments where a proper `window`
    		// is present, execute the factory and get jQuery.
    		// For environments that do not have a `window` with a `document`
    		// (such as Node.js), expose a factory as module.exports.
    		// This accentuates the need for the creation of a real `window`.
    		// e.g. var jQuery = require("jquery")(window);
    		// See ticket #14549 for more info.
    		module.exports = global.document ?
    			factory( global, true ) :
    			function( w ) {
    				if ( !w.document ) {
    					throw new Error( "jQuery requires a window with a document" );
    				}
    				return factory( w );
    			};
    	}

    // Pass this if window is not defined yet
    } )( typeof window !== "undefined" ? window : commonjsGlobal, function( window, noGlobal ) {

    var arr = [];

    var getProto = Object.getPrototypeOf;

    var slice = arr.slice;

    var flat = function( array ) {
    	return arr.concat.apply( [], array );
    };


    var push = arr.push;

    var indexOf = arr.indexOf;

    var class2type = {};

    var toString = class2type.toString;

    var hasOwn = class2type.hasOwnProperty;

    var fnToString = hasOwn.toString;

    var ObjectFunctionString = fnToString.call( Object );

    var support = {};

    var isFunction = function isFunction( obj ) {

    		// Support: Chrome <=57, Firefox <=52
    		// In some browsers, typeof returns "function" for HTML <object> elements
    		// (i.e., `typeof document.createElement( "object" ) === "function"`).
    		// We don't want to classify *any* DOM node as a function.
    		// Support: QtWeb <=3.8.5, WebKit <=534.34, wkhtmltopdf tool <=0.12.5
    		// Plus for old WebKit, typeof returns "function" for HTML collections
    		// (e.g., `typeof document.getElementsByTagName("div") === "function"`). (gh-4756)
    		return typeof obj === "function" && typeof obj.nodeType !== "number" &&
    			typeof obj.item !== "function";
    	};


    var isWindow = function isWindow( obj ) {
    		return obj != null && obj === obj.window;
    	};


    var document = window.document;



    	var preservedScriptAttributes = {
    		type: true,
    		src: true,
    		nonce: true,
    		noModule: true
    	};

    	function DOMEval( code, node, doc ) {
    		doc = doc || document;

    		var i, val,
    			script = doc.createElement( "script" );

    		script.text = code;
    		if ( node ) {
    			for ( i in preservedScriptAttributes ) {

    				// Support: Firefox 64+, Edge 18+
    				// Some browsers don't support the "nonce" property on scripts.
    				// On the other hand, just using `getAttribute` is not enough as
    				// the `nonce` attribute is reset to an empty string whenever it
    				// becomes browsing-context connected.
    				// See https://github.com/whatwg/html/issues/2369
    				// See https://html.spec.whatwg.org/#nonce-attributes
    				// The `node.getAttribute` check was added for the sake of
    				// `jQuery.globalEval` so that it can fake a nonce-containing node
    				// via an object.
    				val = node[ i ] || node.getAttribute && node.getAttribute( i );
    				if ( val ) {
    					script.setAttribute( i, val );
    				}
    			}
    		}
    		doc.head.appendChild( script ).parentNode.removeChild( script );
    	}


    function toType( obj ) {
    	if ( obj == null ) {
    		return obj + "";
    	}

    	// Support: Android <=2.3 only (functionish RegExp)
    	return typeof obj === "object" || typeof obj === "function" ?
    		class2type[ toString.call( obj ) ] || "object" :
    		typeof obj;
    }
    /* global Symbol */
    // Defining this global in .eslintrc.json would create a danger of using the global
    // unguarded in another place, it seems safer to define global only for this module



    var
    	version = "3.6.0",

    	// Define a local copy of jQuery
    	jQuery = function( selector, context ) {

    		// The jQuery object is actually just the init constructor 'enhanced'
    		// Need init if jQuery is called (just allow error to be thrown if not included)
    		return new jQuery.fn.init( selector, context );
    	};

    jQuery.fn = jQuery.prototype = {

    	// The current version of jQuery being used
    	jquery: version,

    	constructor: jQuery,

    	// The default length of a jQuery object is 0
    	length: 0,

    	toArray: function() {
    		return slice.call( this );
    	},

    	// Get the Nth element in the matched element set OR
    	// Get the whole matched element set as a clean array
    	get: function( num ) {

    		// Return all the elements in a clean array
    		if ( num == null ) {
    			return slice.call( this );
    		}

    		// Return just the one element from the set
    		return num < 0 ? this[ num + this.length ] : this[ num ];
    	},

    	// Take an array of elements and push it onto the stack
    	// (returning the new matched element set)
    	pushStack: function( elems ) {

    		// Build a new jQuery matched element set
    		var ret = jQuery.merge( this.constructor(), elems );

    		// Add the old object onto the stack (as a reference)
    		ret.prevObject = this;

    		// Return the newly-formed element set
    		return ret;
    	},

    	// Execute a callback for every element in the matched set.
    	each: function( callback ) {
    		return jQuery.each( this, callback );
    	},

    	map: function( callback ) {
    		return this.pushStack( jQuery.map( this, function( elem, i ) {
    			return callback.call( elem, i, elem );
    		} ) );
    	},

    	slice: function() {
    		return this.pushStack( slice.apply( this, arguments ) );
    	},

    	first: function() {
    		return this.eq( 0 );
    	},

    	last: function() {
    		return this.eq( -1 );
    	},

    	even: function() {
    		return this.pushStack( jQuery.grep( this, function( _elem, i ) {
    			return ( i + 1 ) % 2;
    		} ) );
    	},

    	odd: function() {
    		return this.pushStack( jQuery.grep( this, function( _elem, i ) {
    			return i % 2;
    		} ) );
    	},

    	eq: function( i ) {
    		var len = this.length,
    			j = +i + ( i < 0 ? len : 0 );
    		return this.pushStack( j >= 0 && j < len ? [ this[ j ] ] : [] );
    	},

    	end: function() {
    		return this.prevObject || this.constructor();
    	},

    	// For internal use only.
    	// Behaves like an Array's method, not like a jQuery method.
    	push: push,
    	sort: arr.sort,
    	splice: arr.splice
    };

    jQuery.extend = jQuery.fn.extend = function() {
    	var options, name, src, copy, copyIsArray, clone,
    		target = arguments[ 0 ] || {},
    		i = 1,
    		length = arguments.length,
    		deep = false;

    	// Handle a deep copy situation
    	if ( typeof target === "boolean" ) {
    		deep = target;

    		// Skip the boolean and the target
    		target = arguments[ i ] || {};
    		i++;
    	}

    	// Handle case when target is a string or something (possible in deep copy)
    	if ( typeof target !== "object" && !isFunction( target ) ) {
    		target = {};
    	}

    	// Extend jQuery itself if only one argument is passed
    	if ( i === length ) {
    		target = this;
    		i--;
    	}

    	for ( ; i < length; i++ ) {

    		// Only deal with non-null/undefined values
    		if ( ( options = arguments[ i ] ) != null ) {

    			// Extend the base object
    			for ( name in options ) {
    				copy = options[ name ];

    				// Prevent Object.prototype pollution
    				// Prevent never-ending loop
    				if ( name === "__proto__" || target === copy ) {
    					continue;
    				}

    				// Recurse if we're merging plain objects or arrays
    				if ( deep && copy && ( jQuery.isPlainObject( copy ) ||
    					( copyIsArray = Array.isArray( copy ) ) ) ) {
    					src = target[ name ];

    					// Ensure proper type for the source value
    					if ( copyIsArray && !Array.isArray( src ) ) {
    						clone = [];
    					} else if ( !copyIsArray && !jQuery.isPlainObject( src ) ) {
    						clone = {};
    					} else {
    						clone = src;
    					}
    					copyIsArray = false;

    					// Never move original objects, clone them
    					target[ name ] = jQuery.extend( deep, clone, copy );

    				// Don't bring in undefined values
    				} else if ( copy !== undefined ) {
    					target[ name ] = copy;
    				}
    			}
    		}
    	}

    	// Return the modified object
    	return target;
    };

    jQuery.extend( {

    	// Unique for each copy of jQuery on the page
    	expando: "jQuery" + ( version + Math.random() ).replace( /\D/g, "" ),

    	// Assume jQuery is ready without the ready module
    	isReady: true,

    	error: function( msg ) {
    		throw new Error( msg );
    	},

    	noop: function() {},

    	isPlainObject: function( obj ) {
    		var proto, Ctor;

    		// Detect obvious negatives
    		// Use toString instead of jQuery.type to catch host objects
    		if ( !obj || toString.call( obj ) !== "[object Object]" ) {
    			return false;
    		}

    		proto = getProto( obj );

    		// Objects with no prototype (e.g., `Object.create( null )`) are plain
    		if ( !proto ) {
    			return true;
    		}

    		// Objects with prototype are plain iff they were constructed by a global Object function
    		Ctor = hasOwn.call( proto, "constructor" ) && proto.constructor;
    		return typeof Ctor === "function" && fnToString.call( Ctor ) === ObjectFunctionString;
    	},

    	isEmptyObject: function( obj ) {
    		var name;

    		for ( name in obj ) {
    			return false;
    		}
    		return true;
    	},

    	// Evaluates a script in a provided context; falls back to the global one
    	// if not specified.
    	globalEval: function( code, options, doc ) {
    		DOMEval( code, { nonce: options && options.nonce }, doc );
    	},

    	each: function( obj, callback ) {
    		var length, i = 0;

    		if ( isArrayLike( obj ) ) {
    			length = obj.length;
    			for ( ; i < length; i++ ) {
    				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
    					break;
    				}
    			}
    		} else {
    			for ( i in obj ) {
    				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
    					break;
    				}
    			}
    		}

    		return obj;
    	},

    	// results is for internal usage only
    	makeArray: function( arr, results ) {
    		var ret = results || [];

    		if ( arr != null ) {
    			if ( isArrayLike( Object( arr ) ) ) {
    				jQuery.merge( ret,
    					typeof arr === "string" ?
    						[ arr ] : arr
    				);
    			} else {
    				push.call( ret, arr );
    			}
    		}

    		return ret;
    	},

    	inArray: function( elem, arr, i ) {
    		return arr == null ? -1 : indexOf.call( arr, elem, i );
    	},

    	// Support: Android <=4.0 only, PhantomJS 1 only
    	// push.apply(_, arraylike) throws on ancient WebKit
    	merge: function( first, second ) {
    		var len = +second.length,
    			j = 0,
    			i = first.length;

    		for ( ; j < len; j++ ) {
    			first[ i++ ] = second[ j ];
    		}

    		first.length = i;

    		return first;
    	},

    	grep: function( elems, callback, invert ) {
    		var callbackInverse,
    			matches = [],
    			i = 0,
    			length = elems.length,
    			callbackExpect = !invert;

    		// Go through the array, only saving the items
    		// that pass the validator function
    		for ( ; i < length; i++ ) {
    			callbackInverse = !callback( elems[ i ], i );
    			if ( callbackInverse !== callbackExpect ) {
    				matches.push( elems[ i ] );
    			}
    		}

    		return matches;
    	},

    	// arg is for internal usage only
    	map: function( elems, callback, arg ) {
    		var length, value,
    			i = 0,
    			ret = [];

    		// Go through the array, translating each of the items to their new values
    		if ( isArrayLike( elems ) ) {
    			length = elems.length;
    			for ( ; i < length; i++ ) {
    				value = callback( elems[ i ], i, arg );

    				if ( value != null ) {
    					ret.push( value );
    				}
    			}

    		// Go through every key on the object,
    		} else {
    			for ( i in elems ) {
    				value = callback( elems[ i ], i, arg );

    				if ( value != null ) {
    					ret.push( value );
    				}
    			}
    		}

    		// Flatten any nested arrays
    		return flat( ret );
    	},

    	// A global GUID counter for objects
    	guid: 1,

    	// jQuery.support is not used in Core but other projects attach their
    	// properties to it so it needs to exist.
    	support: support
    } );

    if ( typeof Symbol === "function" ) {
    	jQuery.fn[ Symbol.iterator ] = arr[ Symbol.iterator ];
    }

    // Populate the class2type map
    jQuery.each( "Boolean Number String Function Array Date RegExp Object Error Symbol".split( " " ),
    	function( _i, name ) {
    		class2type[ "[object " + name + "]" ] = name.toLowerCase();
    	} );

    function isArrayLike( obj ) {

    	// Support: real iOS 8.2 only (not reproducible in simulator)
    	// `in` check used to prevent JIT error (gh-2145)
    	// hasOwn isn't used here due to false negatives
    	// regarding Nodelist length in IE
    	var length = !!obj && "length" in obj && obj.length,
    		type = toType( obj );

    	if ( isFunction( obj ) || isWindow( obj ) ) {
    		return false;
    	}

    	return type === "array" || length === 0 ||
    		typeof length === "number" && length > 0 && ( length - 1 ) in obj;
    }
    var Sizzle =
    /*!
     * Sizzle CSS Selector Engine v2.3.6
     * https://sizzlejs.com/
     *
     * Copyright JS Foundation and other contributors
     * Released under the MIT license
     * https://js.foundation/
     *
     * Date: 2021-02-16
     */
    ( function( window ) {
    var i,
    	support,
    	Expr,
    	getText,
    	isXML,
    	tokenize,
    	compile,
    	select,
    	outermostContext,
    	sortInput,
    	hasDuplicate,

    	// Local document vars
    	setDocument,
    	document,
    	docElem,
    	documentIsHTML,
    	rbuggyQSA,
    	rbuggyMatches,
    	matches,
    	contains,

    	// Instance-specific data
    	expando = "sizzle" + 1 * new Date(),
    	preferredDoc = window.document,
    	dirruns = 0,
    	done = 0,
    	classCache = createCache(),
    	tokenCache = createCache(),
    	compilerCache = createCache(),
    	nonnativeSelectorCache = createCache(),
    	sortOrder = function( a, b ) {
    		if ( a === b ) {
    			hasDuplicate = true;
    		}
    		return 0;
    	},

    	// Instance methods
    	hasOwn = ( {} ).hasOwnProperty,
    	arr = [],
    	pop = arr.pop,
    	pushNative = arr.push,
    	push = arr.push,
    	slice = arr.slice,

    	// Use a stripped-down indexOf as it's faster than native
    	// https://jsperf.com/thor-indexof-vs-for/5
    	indexOf = function( list, elem ) {
    		var i = 0,
    			len = list.length;
    		for ( ; i < len; i++ ) {
    			if ( list[ i ] === elem ) {
    				return i;
    			}
    		}
    		return -1;
    	},

    	booleans = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|" +
    		"ismap|loop|multiple|open|readonly|required|scoped",

    	// Regular expressions

    	// http://www.w3.org/TR/css3-selectors/#whitespace
    	whitespace = "[\\x20\\t\\r\\n\\f]",

    	// https://www.w3.org/TR/css-syntax-3/#ident-token-diagram
    	identifier = "(?:\\\\[\\da-fA-F]{1,6}" + whitespace +
    		"?|\\\\[^\\r\\n\\f]|[\\w-]|[^\0-\\x7f])+",

    	// Attribute selectors: http://www.w3.org/TR/selectors/#attribute-selectors
    	attributes = "\\[" + whitespace + "*(" + identifier + ")(?:" + whitespace +

    		// Operator (capture 2)
    		"*([*^$|!~]?=)" + whitespace +

    		// "Attribute values must be CSS identifiers [capture 5]
    		// or strings [capture 3 or capture 4]"
    		"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|(" + identifier + "))|)" +
    		whitespace + "*\\]",

    	pseudos = ":(" + identifier + ")(?:\\((" +

    		// To reduce the number of selectors needing tokenize in the preFilter, prefer arguments:
    		// 1. quoted (capture 3; capture 4 or capture 5)
    		"('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|" +

    		// 2. simple (capture 6)
    		"((?:\\\\.|[^\\\\()[\\]]|" + attributes + ")*)|" +

    		// 3. anything else (capture 2)
    		".*" +
    		")\\)|)",

    	// Leading and non-escaped trailing whitespace, capturing some non-whitespace characters preceding the latter
    	rwhitespace = new RegExp( whitespace + "+", "g" ),
    	rtrim = new RegExp( "^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" +
    		whitespace + "+$", "g" ),

    	rcomma = new RegExp( "^" + whitespace + "*," + whitespace + "*" ),
    	rcombinators = new RegExp( "^" + whitespace + "*([>+~]|" + whitespace + ")" + whitespace +
    		"*" ),
    	rdescend = new RegExp( whitespace + "|>" ),

    	rpseudo = new RegExp( pseudos ),
    	ridentifier = new RegExp( "^" + identifier + "$" ),

    	matchExpr = {
    		"ID": new RegExp( "^#(" + identifier + ")" ),
    		"CLASS": new RegExp( "^\\.(" + identifier + ")" ),
    		"TAG": new RegExp( "^(" + identifier + "|[*])" ),
    		"ATTR": new RegExp( "^" + attributes ),
    		"PSEUDO": new RegExp( "^" + pseudos ),
    		"CHILD": new RegExp( "^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" +
    			whitespace + "*(even|odd|(([+-]|)(\\d*)n|)" + whitespace + "*(?:([+-]|)" +
    			whitespace + "*(\\d+)|))" + whitespace + "*\\)|)", "i" ),
    		"bool": new RegExp( "^(?:" + booleans + ")$", "i" ),

    		// For use in libraries implementing .is()
    		// We use this for POS matching in `select`
    		"needsContext": new RegExp( "^" + whitespace +
    			"*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" + whitespace +
    			"*((?:-\\d)?\\d*)" + whitespace + "*\\)|)(?=[^-]|$)", "i" )
    	},

    	rhtml = /HTML$/i,
    	rinputs = /^(?:input|select|textarea|button)$/i,
    	rheader = /^h\d$/i,

    	rnative = /^[^{]+\{\s*\[native \w/,

    	// Easily-parseable/retrievable ID or TAG or CLASS selectors
    	rquickExpr = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,

    	rsibling = /[+~]/,

    	// CSS escapes
    	// http://www.w3.org/TR/CSS21/syndata.html#escaped-characters
    	runescape = new RegExp( "\\\\[\\da-fA-F]{1,6}" + whitespace + "?|\\\\([^\\r\\n\\f])", "g" ),
    	funescape = function( escape, nonHex ) {
    		var high = "0x" + escape.slice( 1 ) - 0x10000;

    		return nonHex ?

    			// Strip the backslash prefix from a non-hex escape sequence
    			nonHex :

    			// Replace a hexadecimal escape sequence with the encoded Unicode code point
    			// Support: IE <=11+
    			// For values outside the Basic Multilingual Plane (BMP), manually construct a
    			// surrogate pair
    			high < 0 ?
    				String.fromCharCode( high + 0x10000 ) :
    				String.fromCharCode( high >> 10 | 0xD800, high & 0x3FF | 0xDC00 );
    	},

    	// CSS string/identifier serialization
    	// https://drafts.csswg.org/cssom/#common-serializing-idioms
    	rcssescape = /([\0-\x1f\x7f]|^-?\d)|^-$|[^\0-\x1f\x7f-\uFFFF\w-]/g,
    	fcssescape = function( ch, asCodePoint ) {
    		if ( asCodePoint ) {

    			// U+0000 NULL becomes U+FFFD REPLACEMENT CHARACTER
    			if ( ch === "\0" ) {
    				return "\uFFFD";
    			}

    			// Control characters and (dependent upon position) numbers get escaped as code points
    			return ch.slice( 0, -1 ) + "\\" +
    				ch.charCodeAt( ch.length - 1 ).toString( 16 ) + " ";
    		}

    		// Other potentially-special ASCII characters get backslash-escaped
    		return "\\" + ch;
    	},

    	// Used for iframes
    	// See setDocument()
    	// Removing the function wrapper causes a "Permission Denied"
    	// error in IE
    	unloadHandler = function() {
    		setDocument();
    	},

    	inDisabledFieldset = addCombinator(
    		function( elem ) {
    			return elem.disabled === true && elem.nodeName.toLowerCase() === "fieldset";
    		},
    		{ dir: "parentNode", next: "legend" }
    	);

    // Optimize for push.apply( _, NodeList )
    try {
    	push.apply(
    		( arr = slice.call( preferredDoc.childNodes ) ),
    		preferredDoc.childNodes
    	);

    	// Support: Android<4.0
    	// Detect silently failing push.apply
    	// eslint-disable-next-line no-unused-expressions
    	arr[ preferredDoc.childNodes.length ].nodeType;
    } catch ( e ) {
    	push = { apply: arr.length ?

    		// Leverage slice if possible
    		function( target, els ) {
    			pushNative.apply( target, slice.call( els ) );
    		} :

    		// Support: IE<9
    		// Otherwise append directly
    		function( target, els ) {
    			var j = target.length,
    				i = 0;

    			// Can't trust NodeList.length
    			while ( ( target[ j++ ] = els[ i++ ] ) ) {}
    			target.length = j - 1;
    		}
    	};
    }

    function Sizzle( selector, context, results, seed ) {
    	var m, i, elem, nid, match, groups, newSelector,
    		newContext = context && context.ownerDocument,

    		// nodeType defaults to 9, since context defaults to document
    		nodeType = context ? context.nodeType : 9;

    	results = results || [];

    	// Return early from calls with invalid selector or context
    	if ( typeof selector !== "string" || !selector ||
    		nodeType !== 1 && nodeType !== 9 && nodeType !== 11 ) {

    		return results;
    	}

    	// Try to shortcut find operations (as opposed to filters) in HTML documents
    	if ( !seed ) {
    		setDocument( context );
    		context = context || document;

    		if ( documentIsHTML ) {

    			// If the selector is sufficiently simple, try using a "get*By*" DOM method
    			// (excepting DocumentFragment context, where the methods don't exist)
    			if ( nodeType !== 11 && ( match = rquickExpr.exec( selector ) ) ) {

    				// ID selector
    				if ( ( m = match[ 1 ] ) ) {

    					// Document context
    					if ( nodeType === 9 ) {
    						if ( ( elem = context.getElementById( m ) ) ) {

    							// Support: IE, Opera, Webkit
    							// TODO: identify versions
    							// getElementById can match elements by name instead of ID
    							if ( elem.id === m ) {
    								results.push( elem );
    								return results;
    							}
    						} else {
    							return results;
    						}

    					// Element context
    					} else {

    						// Support: IE, Opera, Webkit
    						// TODO: identify versions
    						// getElementById can match elements by name instead of ID
    						if ( newContext && ( elem = newContext.getElementById( m ) ) &&
    							contains( context, elem ) &&
    							elem.id === m ) {

    							results.push( elem );
    							return results;
    						}
    					}

    				// Type selector
    				} else if ( match[ 2 ] ) {
    					push.apply( results, context.getElementsByTagName( selector ) );
    					return results;

    				// Class selector
    				} else if ( ( m = match[ 3 ] ) && support.getElementsByClassName &&
    					context.getElementsByClassName ) {

    					push.apply( results, context.getElementsByClassName( m ) );
    					return results;
    				}
    			}

    			// Take advantage of querySelectorAll
    			if ( support.qsa &&
    				!nonnativeSelectorCache[ selector + " " ] &&
    				( !rbuggyQSA || !rbuggyQSA.test( selector ) ) &&

    				// Support: IE 8 only
    				// Exclude object elements
    				( nodeType !== 1 || context.nodeName.toLowerCase() !== "object" ) ) {

    				newSelector = selector;
    				newContext = context;

    				// qSA considers elements outside a scoping root when evaluating child or
    				// descendant combinators, which is not what we want.
    				// In such cases, we work around the behavior by prefixing every selector in the
    				// list with an ID selector referencing the scope context.
    				// The technique has to be used as well when a leading combinator is used
    				// as such selectors are not recognized by querySelectorAll.
    				// Thanks to Andrew Dupont for this technique.
    				if ( nodeType === 1 &&
    					( rdescend.test( selector ) || rcombinators.test( selector ) ) ) {

    					// Expand context for sibling selectors
    					newContext = rsibling.test( selector ) && testContext( context.parentNode ) ||
    						context;

    					// We can use :scope instead of the ID hack if the browser
    					// supports it & if we're not changing the context.
    					if ( newContext !== context || !support.scope ) {

    						// Capture the context ID, setting it first if necessary
    						if ( ( nid = context.getAttribute( "id" ) ) ) {
    							nid = nid.replace( rcssescape, fcssescape );
    						} else {
    							context.setAttribute( "id", ( nid = expando ) );
    						}
    					}

    					// Prefix every selector in the list
    					groups = tokenize( selector );
    					i = groups.length;
    					while ( i-- ) {
    						groups[ i ] = ( nid ? "#" + nid : ":scope" ) + " " +
    							toSelector( groups[ i ] );
    					}
    					newSelector = groups.join( "," );
    				}

    				try {
    					push.apply( results,
    						newContext.querySelectorAll( newSelector )
    					);
    					return results;
    				} catch ( qsaError ) {
    					nonnativeSelectorCache( selector, true );
    				} finally {
    					if ( nid === expando ) {
    						context.removeAttribute( "id" );
    					}
    				}
    			}
    		}
    	}

    	// All others
    	return select( selector.replace( rtrim, "$1" ), context, results, seed );
    }

    /**
     * Create key-value caches of limited size
     * @returns {function(string, object)} Returns the Object data after storing it on itself with
     *	property name the (space-suffixed) string and (if the cache is larger than Expr.cacheLength)
     *	deleting the oldest entry
     */
    function createCache() {
    	var keys = [];

    	function cache( key, value ) {

    		// Use (key + " ") to avoid collision with native prototype properties (see Issue #157)
    		if ( keys.push( key + " " ) > Expr.cacheLength ) {

    			// Only keep the most recent entries
    			delete cache[ keys.shift() ];
    		}
    		return ( cache[ key + " " ] = value );
    	}
    	return cache;
    }

    /**
     * Mark a function for special use by Sizzle
     * @param {Function} fn The function to mark
     */
    function markFunction( fn ) {
    	fn[ expando ] = true;
    	return fn;
    }

    /**
     * Support testing using an element
     * @param {Function} fn Passed the created element and returns a boolean result
     */
    function assert( fn ) {
    	var el = document.createElement( "fieldset" );

    	try {
    		return !!fn( el );
    	} catch ( e ) {
    		return false;
    	} finally {

    		// Remove from its parent by default
    		if ( el.parentNode ) {
    			el.parentNode.removeChild( el );
    		}

    		// release memory in IE
    		el = null;
    	}
    }

    /**
     * Adds the same handler for all of the specified attrs
     * @param {String} attrs Pipe-separated list of attributes
     * @param {Function} handler The method that will be applied
     */
    function addHandle( attrs, handler ) {
    	var arr = attrs.split( "|" ),
    		i = arr.length;

    	while ( i-- ) {
    		Expr.attrHandle[ arr[ i ] ] = handler;
    	}
    }

    /**
     * Checks document order of two siblings
     * @param {Element} a
     * @param {Element} b
     * @returns {Number} Returns less than 0 if a precedes b, greater than 0 if a follows b
     */
    function siblingCheck( a, b ) {
    	var cur = b && a,
    		diff = cur && a.nodeType === 1 && b.nodeType === 1 &&
    			a.sourceIndex - b.sourceIndex;

    	// Use IE sourceIndex if available on both nodes
    	if ( diff ) {
    		return diff;
    	}

    	// Check if b follows a
    	if ( cur ) {
    		while ( ( cur = cur.nextSibling ) ) {
    			if ( cur === b ) {
    				return -1;
    			}
    		}
    	}

    	return a ? 1 : -1;
    }

    /**
     * Returns a function to use in pseudos for input types
     * @param {String} type
     */
    function createInputPseudo( type ) {
    	return function( elem ) {
    		var name = elem.nodeName.toLowerCase();
    		return name === "input" && elem.type === type;
    	};
    }

    /**
     * Returns a function to use in pseudos for buttons
     * @param {String} type
     */
    function createButtonPseudo( type ) {
    	return function( elem ) {
    		var name = elem.nodeName.toLowerCase();
    		return ( name === "input" || name === "button" ) && elem.type === type;
    	};
    }

    /**
     * Returns a function to use in pseudos for :enabled/:disabled
     * @param {Boolean} disabled true for :disabled; false for :enabled
     */
    function createDisabledPseudo( disabled ) {

    	// Known :disabled false positives: fieldset[disabled] > legend:nth-of-type(n+2) :can-disable
    	return function( elem ) {

    		// Only certain elements can match :enabled or :disabled
    		// https://html.spec.whatwg.org/multipage/scripting.html#selector-enabled
    		// https://html.spec.whatwg.org/multipage/scripting.html#selector-disabled
    		if ( "form" in elem ) {

    			// Check for inherited disabledness on relevant non-disabled elements:
    			// * listed form-associated elements in a disabled fieldset
    			//   https://html.spec.whatwg.org/multipage/forms.html#category-listed
    			//   https://html.spec.whatwg.org/multipage/forms.html#concept-fe-disabled
    			// * option elements in a disabled optgroup
    			//   https://html.spec.whatwg.org/multipage/forms.html#concept-option-disabled
    			// All such elements have a "form" property.
    			if ( elem.parentNode && elem.disabled === false ) {

    				// Option elements defer to a parent optgroup if present
    				if ( "label" in elem ) {
    					if ( "label" in elem.parentNode ) {
    						return elem.parentNode.disabled === disabled;
    					} else {
    						return elem.disabled === disabled;
    					}
    				}

    				// Support: IE 6 - 11
    				// Use the isDisabled shortcut property to check for disabled fieldset ancestors
    				return elem.isDisabled === disabled ||

    					// Where there is no isDisabled, check manually
    					/* jshint -W018 */
    					elem.isDisabled !== !disabled &&
    					inDisabledFieldset( elem ) === disabled;
    			}

    			return elem.disabled === disabled;

    		// Try to winnow out elements that can't be disabled before trusting the disabled property.
    		// Some victims get caught in our net (label, legend, menu, track), but it shouldn't
    		// even exist on them, let alone have a boolean value.
    		} else if ( "label" in elem ) {
    			return elem.disabled === disabled;
    		}

    		// Remaining elements are neither :enabled nor :disabled
    		return false;
    	};
    }

    /**
     * Returns a function to use in pseudos for positionals
     * @param {Function} fn
     */
    function createPositionalPseudo( fn ) {
    	return markFunction( function( argument ) {
    		argument = +argument;
    		return markFunction( function( seed, matches ) {
    			var j,
    				matchIndexes = fn( [], seed.length, argument ),
    				i = matchIndexes.length;

    			// Match elements found at the specified indexes
    			while ( i-- ) {
    				if ( seed[ ( j = matchIndexes[ i ] ) ] ) {
    					seed[ j ] = !( matches[ j ] = seed[ j ] );
    				}
    			}
    		} );
    	} );
    }

    /**
     * Checks a node for validity as a Sizzle context
     * @param {Element|Object=} context
     * @returns {Element|Object|Boolean} The input node if acceptable, otherwise a falsy value
     */
    function testContext( context ) {
    	return context && typeof context.getElementsByTagName !== "undefined" && context;
    }

    // Expose support vars for convenience
    support = Sizzle.support = {};

    /**
     * Detects XML nodes
     * @param {Element|Object} elem An element or a document
     * @returns {Boolean} True iff elem is a non-HTML XML node
     */
    isXML = Sizzle.isXML = function( elem ) {
    	var namespace = elem && elem.namespaceURI,
    		docElem = elem && ( elem.ownerDocument || elem ).documentElement;

    	// Support: IE <=8
    	// Assume HTML when documentElement doesn't yet exist, such as inside loading iframes
    	// https://bugs.jquery.com/ticket/4833
    	return !rhtml.test( namespace || docElem && docElem.nodeName || "HTML" );
    };

    /**
     * Sets document-related variables once based on the current document
     * @param {Element|Object} [doc] An element or document object to use to set the document
     * @returns {Object} Returns the current document
     */
    setDocument = Sizzle.setDocument = function( node ) {
    	var hasCompare, subWindow,
    		doc = node ? node.ownerDocument || node : preferredDoc;

    	// Return early if doc is invalid or already selected
    	// Support: IE 11+, Edge 17 - 18+
    	// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
    	// two documents; shallow comparisons work.
    	// eslint-disable-next-line eqeqeq
    	if ( doc == document || doc.nodeType !== 9 || !doc.documentElement ) {
    		return document;
    	}

    	// Update global variables
    	document = doc;
    	docElem = document.documentElement;
    	documentIsHTML = !isXML( document );

    	// Support: IE 9 - 11+, Edge 12 - 18+
    	// Accessing iframe documents after unload throws "permission denied" errors (jQuery #13936)
    	// Support: IE 11+, Edge 17 - 18+
    	// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
    	// two documents; shallow comparisons work.
    	// eslint-disable-next-line eqeqeq
    	if ( preferredDoc != document &&
    		( subWindow = document.defaultView ) && subWindow.top !== subWindow ) {

    		// Support: IE 11, Edge
    		if ( subWindow.addEventListener ) {
    			subWindow.addEventListener( "unload", unloadHandler, false );

    		// Support: IE 9 - 10 only
    		} else if ( subWindow.attachEvent ) {
    			subWindow.attachEvent( "onunload", unloadHandler );
    		}
    	}

    	// Support: IE 8 - 11+, Edge 12 - 18+, Chrome <=16 - 25 only, Firefox <=3.6 - 31 only,
    	// Safari 4 - 5 only, Opera <=11.6 - 12.x only
    	// IE/Edge & older browsers don't support the :scope pseudo-class.
    	// Support: Safari 6.0 only
    	// Safari 6.0 supports :scope but it's an alias of :root there.
    	support.scope = assert( function( el ) {
    		docElem.appendChild( el ).appendChild( document.createElement( "div" ) );
    		return typeof el.querySelectorAll !== "undefined" &&
    			!el.querySelectorAll( ":scope fieldset div" ).length;
    	} );

    	/* Attributes
    	---------------------------------------------------------------------- */

    	// Support: IE<8
    	// Verify that getAttribute really returns attributes and not properties
    	// (excepting IE8 booleans)
    	support.attributes = assert( function( el ) {
    		el.className = "i";
    		return !el.getAttribute( "className" );
    	} );

    	/* getElement(s)By*
    	---------------------------------------------------------------------- */

    	// Check if getElementsByTagName("*") returns only elements
    	support.getElementsByTagName = assert( function( el ) {
    		el.appendChild( document.createComment( "" ) );
    		return !el.getElementsByTagName( "*" ).length;
    	} );

    	// Support: IE<9
    	support.getElementsByClassName = rnative.test( document.getElementsByClassName );

    	// Support: IE<10
    	// Check if getElementById returns elements by name
    	// The broken getElementById methods don't pick up programmatically-set names,
    	// so use a roundabout getElementsByName test
    	support.getById = assert( function( el ) {
    		docElem.appendChild( el ).id = expando;
    		return !document.getElementsByName || !document.getElementsByName( expando ).length;
    	} );

    	// ID filter and find
    	if ( support.getById ) {
    		Expr.filter[ "ID" ] = function( id ) {
    			var attrId = id.replace( runescape, funescape );
    			return function( elem ) {
    				return elem.getAttribute( "id" ) === attrId;
    			};
    		};
    		Expr.find[ "ID" ] = function( id, context ) {
    			if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
    				var elem = context.getElementById( id );
    				return elem ? [ elem ] : [];
    			}
    		};
    	} else {
    		Expr.filter[ "ID" ] =  function( id ) {
    			var attrId = id.replace( runescape, funescape );
    			return function( elem ) {
    				var node = typeof elem.getAttributeNode !== "undefined" &&
    					elem.getAttributeNode( "id" );
    				return node && node.value === attrId;
    			};
    		};

    		// Support: IE 6 - 7 only
    		// getElementById is not reliable as a find shortcut
    		Expr.find[ "ID" ] = function( id, context ) {
    			if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
    				var node, i, elems,
    					elem = context.getElementById( id );

    				if ( elem ) {

    					// Verify the id attribute
    					node = elem.getAttributeNode( "id" );
    					if ( node && node.value === id ) {
    						return [ elem ];
    					}

    					// Fall back on getElementsByName
    					elems = context.getElementsByName( id );
    					i = 0;
    					while ( ( elem = elems[ i++ ] ) ) {
    						node = elem.getAttributeNode( "id" );
    						if ( node && node.value === id ) {
    							return [ elem ];
    						}
    					}
    				}

    				return [];
    			}
    		};
    	}

    	// Tag
    	Expr.find[ "TAG" ] = support.getElementsByTagName ?
    		function( tag, context ) {
    			if ( typeof context.getElementsByTagName !== "undefined" ) {
    				return context.getElementsByTagName( tag );

    			// DocumentFragment nodes don't have gEBTN
    			} else if ( support.qsa ) {
    				return context.querySelectorAll( tag );
    			}
    		} :

    		function( tag, context ) {
    			var elem,
    				tmp = [],
    				i = 0,

    				// By happy coincidence, a (broken) gEBTN appears on DocumentFragment nodes too
    				results = context.getElementsByTagName( tag );

    			// Filter out possible comments
    			if ( tag === "*" ) {
    				while ( ( elem = results[ i++ ] ) ) {
    					if ( elem.nodeType === 1 ) {
    						tmp.push( elem );
    					}
    				}

    				return tmp;
    			}
    			return results;
    		};

    	// Class
    	Expr.find[ "CLASS" ] = support.getElementsByClassName && function( className, context ) {
    		if ( typeof context.getElementsByClassName !== "undefined" && documentIsHTML ) {
    			return context.getElementsByClassName( className );
    		}
    	};

    	/* QSA/matchesSelector
    	---------------------------------------------------------------------- */

    	// QSA and matchesSelector support

    	// matchesSelector(:active) reports false when true (IE9/Opera 11.5)
    	rbuggyMatches = [];

    	// qSa(:focus) reports false when true (Chrome 21)
    	// We allow this because of a bug in IE8/9 that throws an error
    	// whenever `document.activeElement` is accessed on an iframe
    	// So, we allow :focus to pass through QSA all the time to avoid the IE error
    	// See https://bugs.jquery.com/ticket/13378
    	rbuggyQSA = [];

    	if ( ( support.qsa = rnative.test( document.querySelectorAll ) ) ) {

    		// Build QSA regex
    		// Regex strategy adopted from Diego Perini
    		assert( function( el ) {

    			var input;

    			// Select is set to empty string on purpose
    			// This is to test IE's treatment of not explicitly
    			// setting a boolean content attribute,
    			// since its presence should be enough
    			// https://bugs.jquery.com/ticket/12359
    			docElem.appendChild( el ).innerHTML = "<a id='" + expando + "'></a>" +
    				"<select id='" + expando + "-\r\\' msallowcapture=''>" +
    				"<option selected=''></option></select>";

    			// Support: IE8, Opera 11-12.16
    			// Nothing should be selected when empty strings follow ^= or $= or *=
    			// The test attribute must be unknown in Opera but "safe" for WinRT
    			// https://msdn.microsoft.com/en-us/library/ie/hh465388.aspx#attribute_section
    			if ( el.querySelectorAll( "[msallowcapture^='']" ).length ) {
    				rbuggyQSA.push( "[*^$]=" + whitespace + "*(?:''|\"\")" );
    			}

    			// Support: IE8
    			// Boolean attributes and "value" are not treated correctly
    			if ( !el.querySelectorAll( "[selected]" ).length ) {
    				rbuggyQSA.push( "\\[" + whitespace + "*(?:value|" + booleans + ")" );
    			}

    			// Support: Chrome<29, Android<4.4, Safari<7.0+, iOS<7.0+, PhantomJS<1.9.8+
    			if ( !el.querySelectorAll( "[id~=" + expando + "-]" ).length ) {
    				rbuggyQSA.push( "~=" );
    			}

    			// Support: IE 11+, Edge 15 - 18+
    			// IE 11/Edge don't find elements on a `[name='']` query in some cases.
    			// Adding a temporary attribute to the document before the selection works
    			// around the issue.
    			// Interestingly, IE 10 & older don't seem to have the issue.
    			input = document.createElement( "input" );
    			input.setAttribute( "name", "" );
    			el.appendChild( input );
    			if ( !el.querySelectorAll( "[name='']" ).length ) {
    				rbuggyQSA.push( "\\[" + whitespace + "*name" + whitespace + "*=" +
    					whitespace + "*(?:''|\"\")" );
    			}

    			// Webkit/Opera - :checked should return selected option elements
    			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
    			// IE8 throws error here and will not see later tests
    			if ( !el.querySelectorAll( ":checked" ).length ) {
    				rbuggyQSA.push( ":checked" );
    			}

    			// Support: Safari 8+, iOS 8+
    			// https://bugs.webkit.org/show_bug.cgi?id=136851
    			// In-page `selector#id sibling-combinator selector` fails
    			if ( !el.querySelectorAll( "a#" + expando + "+*" ).length ) {
    				rbuggyQSA.push( ".#.+[+~]" );
    			}

    			// Support: Firefox <=3.6 - 5 only
    			// Old Firefox doesn't throw on a badly-escaped identifier.
    			el.querySelectorAll( "\\\f" );
    			rbuggyQSA.push( "[\\r\\n\\f]" );
    		} );

    		assert( function( el ) {
    			el.innerHTML = "<a href='' disabled='disabled'></a>" +
    				"<select disabled='disabled'><option/></select>";

    			// Support: Windows 8 Native Apps
    			// The type and name attributes are restricted during .innerHTML assignment
    			var input = document.createElement( "input" );
    			input.setAttribute( "type", "hidden" );
    			el.appendChild( input ).setAttribute( "name", "D" );

    			// Support: IE8
    			// Enforce case-sensitivity of name attribute
    			if ( el.querySelectorAll( "[name=d]" ).length ) {
    				rbuggyQSA.push( "name" + whitespace + "*[*^$|!~]?=" );
    			}

    			// FF 3.5 - :enabled/:disabled and hidden elements (hidden elements are still enabled)
    			// IE8 throws error here and will not see later tests
    			if ( el.querySelectorAll( ":enabled" ).length !== 2 ) {
    				rbuggyQSA.push( ":enabled", ":disabled" );
    			}

    			// Support: IE9-11+
    			// IE's :disabled selector does not pick up the children of disabled fieldsets
    			docElem.appendChild( el ).disabled = true;
    			if ( el.querySelectorAll( ":disabled" ).length !== 2 ) {
    				rbuggyQSA.push( ":enabled", ":disabled" );
    			}

    			// Support: Opera 10 - 11 only
    			// Opera 10-11 does not throw on post-comma invalid pseudos
    			el.querySelectorAll( "*,:x" );
    			rbuggyQSA.push( ",.*:" );
    		} );
    	}

    	if ( ( support.matchesSelector = rnative.test( ( matches = docElem.matches ||
    		docElem.webkitMatchesSelector ||
    		docElem.mozMatchesSelector ||
    		docElem.oMatchesSelector ||
    		docElem.msMatchesSelector ) ) ) ) {

    		assert( function( el ) {

    			// Check to see if it's possible to do matchesSelector
    			// on a disconnected node (IE 9)
    			support.disconnectedMatch = matches.call( el, "*" );

    			// This should fail with an exception
    			// Gecko does not error, returns false instead
    			matches.call( el, "[s!='']:x" );
    			rbuggyMatches.push( "!=", pseudos );
    		} );
    	}

    	rbuggyQSA = rbuggyQSA.length && new RegExp( rbuggyQSA.join( "|" ) );
    	rbuggyMatches = rbuggyMatches.length && new RegExp( rbuggyMatches.join( "|" ) );

    	/* Contains
    	---------------------------------------------------------------------- */
    	hasCompare = rnative.test( docElem.compareDocumentPosition );

    	// Element contains another
    	// Purposefully self-exclusive
    	// As in, an element does not contain itself
    	contains = hasCompare || rnative.test( docElem.contains ) ?
    		function( a, b ) {
    			var adown = a.nodeType === 9 ? a.documentElement : a,
    				bup = b && b.parentNode;
    			return a === bup || !!( bup && bup.nodeType === 1 && (
    				adown.contains ?
    					adown.contains( bup ) :
    					a.compareDocumentPosition && a.compareDocumentPosition( bup ) & 16
    			) );
    		} :
    		function( a, b ) {
    			if ( b ) {
    				while ( ( b = b.parentNode ) ) {
    					if ( b === a ) {
    						return true;
    					}
    				}
    			}
    			return false;
    		};

    	/* Sorting
    	---------------------------------------------------------------------- */

    	// Document order sorting
    	sortOrder = hasCompare ?
    	function( a, b ) {

    		// Flag for duplicate removal
    		if ( a === b ) {
    			hasDuplicate = true;
    			return 0;
    		}

    		// Sort on method existence if only one input has compareDocumentPosition
    		var compare = !a.compareDocumentPosition - !b.compareDocumentPosition;
    		if ( compare ) {
    			return compare;
    		}

    		// Calculate position if both inputs belong to the same document
    		// Support: IE 11+, Edge 17 - 18+
    		// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
    		// two documents; shallow comparisons work.
    		// eslint-disable-next-line eqeqeq
    		compare = ( a.ownerDocument || a ) == ( b.ownerDocument || b ) ?
    			a.compareDocumentPosition( b ) :

    			// Otherwise we know they are disconnected
    			1;

    		// Disconnected nodes
    		if ( compare & 1 ||
    			( !support.sortDetached && b.compareDocumentPosition( a ) === compare ) ) {

    			// Choose the first element that is related to our preferred document
    			// Support: IE 11+, Edge 17 - 18+
    			// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
    			// two documents; shallow comparisons work.
    			// eslint-disable-next-line eqeqeq
    			if ( a == document || a.ownerDocument == preferredDoc &&
    				contains( preferredDoc, a ) ) {
    				return -1;
    			}

    			// Support: IE 11+, Edge 17 - 18+
    			// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
    			// two documents; shallow comparisons work.
    			// eslint-disable-next-line eqeqeq
    			if ( b == document || b.ownerDocument == preferredDoc &&
    				contains( preferredDoc, b ) ) {
    				return 1;
    			}

    			// Maintain original order
    			return sortInput ?
    				( indexOf( sortInput, a ) - indexOf( sortInput, b ) ) :
    				0;
    		}

    		return compare & 4 ? -1 : 1;
    	} :
    	function( a, b ) {

    		// Exit early if the nodes are identical
    		if ( a === b ) {
    			hasDuplicate = true;
    			return 0;
    		}

    		var cur,
    			i = 0,
    			aup = a.parentNode,
    			bup = b.parentNode,
    			ap = [ a ],
    			bp = [ b ];

    		// Parentless nodes are either documents or disconnected
    		if ( !aup || !bup ) {

    			// Support: IE 11+, Edge 17 - 18+
    			// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
    			// two documents; shallow comparisons work.
    			/* eslint-disable eqeqeq */
    			return a == document ? -1 :
    				b == document ? 1 :
    				/* eslint-enable eqeqeq */
    				aup ? -1 :
    				bup ? 1 :
    				sortInput ?
    				( indexOf( sortInput, a ) - indexOf( sortInput, b ) ) :
    				0;

    		// If the nodes are siblings, we can do a quick check
    		} else if ( aup === bup ) {
    			return siblingCheck( a, b );
    		}

    		// Otherwise we need full lists of their ancestors for comparison
    		cur = a;
    		while ( ( cur = cur.parentNode ) ) {
    			ap.unshift( cur );
    		}
    		cur = b;
    		while ( ( cur = cur.parentNode ) ) {
    			bp.unshift( cur );
    		}

    		// Walk down the tree looking for a discrepancy
    		while ( ap[ i ] === bp[ i ] ) {
    			i++;
    		}

    		return i ?

    			// Do a sibling check if the nodes have a common ancestor
    			siblingCheck( ap[ i ], bp[ i ] ) :

    			// Otherwise nodes in our document sort first
    			// Support: IE 11+, Edge 17 - 18+
    			// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
    			// two documents; shallow comparisons work.
    			/* eslint-disable eqeqeq */
    			ap[ i ] == preferredDoc ? -1 :
    			bp[ i ] == preferredDoc ? 1 :
    			/* eslint-enable eqeqeq */
    			0;
    	};

    	return document;
    };

    Sizzle.matches = function( expr, elements ) {
    	return Sizzle( expr, null, null, elements );
    };

    Sizzle.matchesSelector = function( elem, expr ) {
    	setDocument( elem );

    	if ( support.matchesSelector && documentIsHTML &&
    		!nonnativeSelectorCache[ expr + " " ] &&
    		( !rbuggyMatches || !rbuggyMatches.test( expr ) ) &&
    		( !rbuggyQSA     || !rbuggyQSA.test( expr ) ) ) {

    		try {
    			var ret = matches.call( elem, expr );

    			// IE 9's matchesSelector returns false on disconnected nodes
    			if ( ret || support.disconnectedMatch ||

    				// As well, disconnected nodes are said to be in a document
    				// fragment in IE 9
    				elem.document && elem.document.nodeType !== 11 ) {
    				return ret;
    			}
    		} catch ( e ) {
    			nonnativeSelectorCache( expr, true );
    		}
    	}

    	return Sizzle( expr, document, null, [ elem ] ).length > 0;
    };

    Sizzle.contains = function( context, elem ) {

    	// Set document vars if needed
    	// Support: IE 11+, Edge 17 - 18+
    	// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
    	// two documents; shallow comparisons work.
    	// eslint-disable-next-line eqeqeq
    	if ( ( context.ownerDocument || context ) != document ) {
    		setDocument( context );
    	}
    	return contains( context, elem );
    };

    Sizzle.attr = function( elem, name ) {

    	// Set document vars if needed
    	// Support: IE 11+, Edge 17 - 18+
    	// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
    	// two documents; shallow comparisons work.
    	// eslint-disable-next-line eqeqeq
    	if ( ( elem.ownerDocument || elem ) != document ) {
    		setDocument( elem );
    	}

    	var fn = Expr.attrHandle[ name.toLowerCase() ],

    		// Don't get fooled by Object.prototype properties (jQuery #13807)
    		val = fn && hasOwn.call( Expr.attrHandle, name.toLowerCase() ) ?
    			fn( elem, name, !documentIsHTML ) :
    			undefined;

    	return val !== undefined ?
    		val :
    		support.attributes || !documentIsHTML ?
    			elem.getAttribute( name ) :
    			( val = elem.getAttributeNode( name ) ) && val.specified ?
    				val.value :
    				null;
    };

    Sizzle.escape = function( sel ) {
    	return ( sel + "" ).replace( rcssescape, fcssescape );
    };

    Sizzle.error = function( msg ) {
    	throw new Error( "Syntax error, unrecognized expression: " + msg );
    };

    /**
     * Document sorting and removing duplicates
     * @param {ArrayLike} results
     */
    Sizzle.uniqueSort = function( results ) {
    	var elem,
    		duplicates = [],
    		j = 0,
    		i = 0;

    	// Unless we *know* we can detect duplicates, assume their presence
    	hasDuplicate = !support.detectDuplicates;
    	sortInput = !support.sortStable && results.slice( 0 );
    	results.sort( sortOrder );

    	if ( hasDuplicate ) {
    		while ( ( elem = results[ i++ ] ) ) {
    			if ( elem === results[ i ] ) {
    				j = duplicates.push( i );
    			}
    		}
    		while ( j-- ) {
    			results.splice( duplicates[ j ], 1 );
    		}
    	}

    	// Clear input after sorting to release objects
    	// See https://github.com/jquery/sizzle/pull/225
    	sortInput = null;

    	return results;
    };

    /**
     * Utility function for retrieving the text value of an array of DOM nodes
     * @param {Array|Element} elem
     */
    getText = Sizzle.getText = function( elem ) {
    	var node,
    		ret = "",
    		i = 0,
    		nodeType = elem.nodeType;

    	if ( !nodeType ) {

    		// If no nodeType, this is expected to be an array
    		while ( ( node = elem[ i++ ] ) ) {

    			// Do not traverse comment nodes
    			ret += getText( node );
    		}
    	} else if ( nodeType === 1 || nodeType === 9 || nodeType === 11 ) {

    		// Use textContent for elements
    		// innerText usage removed for consistency of new lines (jQuery #11153)
    		if ( typeof elem.textContent === "string" ) {
    			return elem.textContent;
    		} else {

    			// Traverse its children
    			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
    				ret += getText( elem );
    			}
    		}
    	} else if ( nodeType === 3 || nodeType === 4 ) {
    		return elem.nodeValue;
    	}

    	// Do not include comment or processing instruction nodes

    	return ret;
    };

    Expr = Sizzle.selectors = {

    	// Can be adjusted by the user
    	cacheLength: 50,

    	createPseudo: markFunction,

    	match: matchExpr,

    	attrHandle: {},

    	find: {},

    	relative: {
    		">": { dir: "parentNode", first: true },
    		" ": { dir: "parentNode" },
    		"+": { dir: "previousSibling", first: true },
    		"~": { dir: "previousSibling" }
    	},

    	preFilter: {
    		"ATTR": function( match ) {
    			match[ 1 ] = match[ 1 ].replace( runescape, funescape );

    			// Move the given value to match[3] whether quoted or unquoted
    			match[ 3 ] = ( match[ 3 ] || match[ 4 ] ||
    				match[ 5 ] || "" ).replace( runescape, funescape );

    			if ( match[ 2 ] === "~=" ) {
    				match[ 3 ] = " " + match[ 3 ] + " ";
    			}

    			return match.slice( 0, 4 );
    		},

    		"CHILD": function( match ) {

    			/* matches from matchExpr["CHILD"]
    				1 type (only|nth|...)
    				2 what (child|of-type)
    				3 argument (even|odd|\d*|\d*n([+-]\d+)?|...)
    				4 xn-component of xn+y argument ([+-]?\d*n|)
    				5 sign of xn-component
    				6 x of xn-component
    				7 sign of y-component
    				8 y of y-component
    			*/
    			match[ 1 ] = match[ 1 ].toLowerCase();

    			if ( match[ 1 ].slice( 0, 3 ) === "nth" ) {

    				// nth-* requires argument
    				if ( !match[ 3 ] ) {
    					Sizzle.error( match[ 0 ] );
    				}

    				// numeric x and y parameters for Expr.filter.CHILD
    				// remember that false/true cast respectively to 0/1
    				match[ 4 ] = +( match[ 4 ] ?
    					match[ 5 ] + ( match[ 6 ] || 1 ) :
    					2 * ( match[ 3 ] === "even" || match[ 3 ] === "odd" ) );
    				match[ 5 ] = +( ( match[ 7 ] + match[ 8 ] ) || match[ 3 ] === "odd" );

    				// other types prohibit arguments
    			} else if ( match[ 3 ] ) {
    				Sizzle.error( match[ 0 ] );
    			}

    			return match;
    		},

    		"PSEUDO": function( match ) {
    			var excess,
    				unquoted = !match[ 6 ] && match[ 2 ];

    			if ( matchExpr[ "CHILD" ].test( match[ 0 ] ) ) {
    				return null;
    			}

    			// Accept quoted arguments as-is
    			if ( match[ 3 ] ) {
    				match[ 2 ] = match[ 4 ] || match[ 5 ] || "";

    			// Strip excess characters from unquoted arguments
    			} else if ( unquoted && rpseudo.test( unquoted ) &&

    				// Get excess from tokenize (recursively)
    				( excess = tokenize( unquoted, true ) ) &&

    				// advance to the next closing parenthesis
    				( excess = unquoted.indexOf( ")", unquoted.length - excess ) - unquoted.length ) ) {

    				// excess is a negative index
    				match[ 0 ] = match[ 0 ].slice( 0, excess );
    				match[ 2 ] = unquoted.slice( 0, excess );
    			}

    			// Return only captures needed by the pseudo filter method (type and argument)
    			return match.slice( 0, 3 );
    		}
    	},

    	filter: {

    		"TAG": function( nodeNameSelector ) {
    			var nodeName = nodeNameSelector.replace( runescape, funescape ).toLowerCase();
    			return nodeNameSelector === "*" ?
    				function() {
    					return true;
    				} :
    				function( elem ) {
    					return elem.nodeName && elem.nodeName.toLowerCase() === nodeName;
    				};
    		},

    		"CLASS": function( className ) {
    			var pattern = classCache[ className + " " ];

    			return pattern ||
    				( pattern = new RegExp( "(^|" + whitespace +
    					")" + className + "(" + whitespace + "|$)" ) ) && classCache(
    						className, function( elem ) {
    							return pattern.test(
    								typeof elem.className === "string" && elem.className ||
    								typeof elem.getAttribute !== "undefined" &&
    									elem.getAttribute( "class" ) ||
    								""
    							);
    				} );
    		},

    		"ATTR": function( name, operator, check ) {
    			return function( elem ) {
    				var result = Sizzle.attr( elem, name );

    				if ( result == null ) {
    					return operator === "!=";
    				}
    				if ( !operator ) {
    					return true;
    				}

    				result += "";

    				/* eslint-disable max-len */

    				return operator === "=" ? result === check :
    					operator === "!=" ? result !== check :
    					operator === "^=" ? check && result.indexOf( check ) === 0 :
    					operator === "*=" ? check && result.indexOf( check ) > -1 :
    					operator === "$=" ? check && result.slice( -check.length ) === check :
    					operator === "~=" ? ( " " + result.replace( rwhitespace, " " ) + " " ).indexOf( check ) > -1 :
    					operator === "|=" ? result === check || result.slice( 0, check.length + 1 ) === check + "-" :
    					false;
    				/* eslint-enable max-len */

    			};
    		},

    		"CHILD": function( type, what, _argument, first, last ) {
    			var simple = type.slice( 0, 3 ) !== "nth",
    				forward = type.slice( -4 ) !== "last",
    				ofType = what === "of-type";

    			return first === 1 && last === 0 ?

    				// Shortcut for :nth-*(n)
    				function( elem ) {
    					return !!elem.parentNode;
    				} :

    				function( elem, _context, xml ) {
    					var cache, uniqueCache, outerCache, node, nodeIndex, start,
    						dir = simple !== forward ? "nextSibling" : "previousSibling",
    						parent = elem.parentNode,
    						name = ofType && elem.nodeName.toLowerCase(),
    						useCache = !xml && !ofType,
    						diff = false;

    					if ( parent ) {

    						// :(first|last|only)-(child|of-type)
    						if ( simple ) {
    							while ( dir ) {
    								node = elem;
    								while ( ( node = node[ dir ] ) ) {
    									if ( ofType ?
    										node.nodeName.toLowerCase() === name :
    										node.nodeType === 1 ) {

    										return false;
    									}
    								}

    								// Reverse direction for :only-* (if we haven't yet done so)
    								start = dir = type === "only" && !start && "nextSibling";
    							}
    							return true;
    						}

    						start = [ forward ? parent.firstChild : parent.lastChild ];

    						// non-xml :nth-child(...) stores cache data on `parent`
    						if ( forward && useCache ) {

    							// Seek `elem` from a previously-cached index

    							// ...in a gzip-friendly way
    							node = parent;
    							outerCache = node[ expando ] || ( node[ expando ] = {} );

    							// Support: IE <9 only
    							// Defend against cloned attroperties (jQuery gh-1709)
    							uniqueCache = outerCache[ node.uniqueID ] ||
    								( outerCache[ node.uniqueID ] = {} );

    							cache = uniqueCache[ type ] || [];
    							nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
    							diff = nodeIndex && cache[ 2 ];
    							node = nodeIndex && parent.childNodes[ nodeIndex ];

    							while ( ( node = ++nodeIndex && node && node[ dir ] ||

    								// Fallback to seeking `elem` from the start
    								( diff = nodeIndex = 0 ) || start.pop() ) ) {

    								// When found, cache indexes on `parent` and break
    								if ( node.nodeType === 1 && ++diff && node === elem ) {
    									uniqueCache[ type ] = [ dirruns, nodeIndex, diff ];
    									break;
    								}
    							}

    						} else {

    							// Use previously-cached element index if available
    							if ( useCache ) {

    								// ...in a gzip-friendly way
    								node = elem;
    								outerCache = node[ expando ] || ( node[ expando ] = {} );

    								// Support: IE <9 only
    								// Defend against cloned attroperties (jQuery gh-1709)
    								uniqueCache = outerCache[ node.uniqueID ] ||
    									( outerCache[ node.uniqueID ] = {} );

    								cache = uniqueCache[ type ] || [];
    								nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
    								diff = nodeIndex;
    							}

    							// xml :nth-child(...)
    							// or :nth-last-child(...) or :nth(-last)?-of-type(...)
    							if ( diff === false ) {

    								// Use the same loop as above to seek `elem` from the start
    								while ( ( node = ++nodeIndex && node && node[ dir ] ||
    									( diff = nodeIndex = 0 ) || start.pop() ) ) {

    									if ( ( ofType ?
    										node.nodeName.toLowerCase() === name :
    										node.nodeType === 1 ) &&
    										++diff ) {

    										// Cache the index of each encountered element
    										if ( useCache ) {
    											outerCache = node[ expando ] ||
    												( node[ expando ] = {} );

    											// Support: IE <9 only
    											// Defend against cloned attroperties (jQuery gh-1709)
    											uniqueCache = outerCache[ node.uniqueID ] ||
    												( outerCache[ node.uniqueID ] = {} );

    											uniqueCache[ type ] = [ dirruns, diff ];
    										}

    										if ( node === elem ) {
    											break;
    										}
    									}
    								}
    							}
    						}

    						// Incorporate the offset, then check against cycle size
    						diff -= last;
    						return diff === first || ( diff % first === 0 && diff / first >= 0 );
    					}
    				};
    		},

    		"PSEUDO": function( pseudo, argument ) {

    			// pseudo-class names are case-insensitive
    			// http://www.w3.org/TR/selectors/#pseudo-classes
    			// Prioritize by case sensitivity in case custom pseudos are added with uppercase letters
    			// Remember that setFilters inherits from pseudos
    			var args,
    				fn = Expr.pseudos[ pseudo ] || Expr.setFilters[ pseudo.toLowerCase() ] ||
    					Sizzle.error( "unsupported pseudo: " + pseudo );

    			// The user may use createPseudo to indicate that
    			// arguments are needed to create the filter function
    			// just as Sizzle does
    			if ( fn[ expando ] ) {
    				return fn( argument );
    			}

    			// But maintain support for old signatures
    			if ( fn.length > 1 ) {
    				args = [ pseudo, pseudo, "", argument ];
    				return Expr.setFilters.hasOwnProperty( pseudo.toLowerCase() ) ?
    					markFunction( function( seed, matches ) {
    						var idx,
    							matched = fn( seed, argument ),
    							i = matched.length;
    						while ( i-- ) {
    							idx = indexOf( seed, matched[ i ] );
    							seed[ idx ] = !( matches[ idx ] = matched[ i ] );
    						}
    					} ) :
    					function( elem ) {
    						return fn( elem, 0, args );
    					};
    			}

    			return fn;
    		}
    	},

    	pseudos: {

    		// Potentially complex pseudos
    		"not": markFunction( function( selector ) {

    			// Trim the selector passed to compile
    			// to avoid treating leading and trailing
    			// spaces as combinators
    			var input = [],
    				results = [],
    				matcher = compile( selector.replace( rtrim, "$1" ) );

    			return matcher[ expando ] ?
    				markFunction( function( seed, matches, _context, xml ) {
    					var elem,
    						unmatched = matcher( seed, null, xml, [] ),
    						i = seed.length;

    					// Match elements unmatched by `matcher`
    					while ( i-- ) {
    						if ( ( elem = unmatched[ i ] ) ) {
    							seed[ i ] = !( matches[ i ] = elem );
    						}
    					}
    				} ) :
    				function( elem, _context, xml ) {
    					input[ 0 ] = elem;
    					matcher( input, null, xml, results );

    					// Don't keep the element (issue #299)
    					input[ 0 ] = null;
    					return !results.pop();
    				};
    		} ),

    		"has": markFunction( function( selector ) {
    			return function( elem ) {
    				return Sizzle( selector, elem ).length > 0;
    			};
    		} ),

    		"contains": markFunction( function( text ) {
    			text = text.replace( runescape, funescape );
    			return function( elem ) {
    				return ( elem.textContent || getText( elem ) ).indexOf( text ) > -1;
    			};
    		} ),

    		// "Whether an element is represented by a :lang() selector
    		// is based solely on the element's language value
    		// being equal to the identifier C,
    		// or beginning with the identifier C immediately followed by "-".
    		// The matching of C against the element's language value is performed case-insensitively.
    		// The identifier C does not have to be a valid language name."
    		// http://www.w3.org/TR/selectors/#lang-pseudo
    		"lang": markFunction( function( lang ) {

    			// lang value must be a valid identifier
    			if ( !ridentifier.test( lang || "" ) ) {
    				Sizzle.error( "unsupported lang: " + lang );
    			}
    			lang = lang.replace( runescape, funescape ).toLowerCase();
    			return function( elem ) {
    				var elemLang;
    				do {
    					if ( ( elemLang = documentIsHTML ?
    						elem.lang :
    						elem.getAttribute( "xml:lang" ) || elem.getAttribute( "lang" ) ) ) {

    						elemLang = elemLang.toLowerCase();
    						return elemLang === lang || elemLang.indexOf( lang + "-" ) === 0;
    					}
    				} while ( ( elem = elem.parentNode ) && elem.nodeType === 1 );
    				return false;
    			};
    		} ),

    		// Miscellaneous
    		"target": function( elem ) {
    			var hash = window.location && window.location.hash;
    			return hash && hash.slice( 1 ) === elem.id;
    		},

    		"root": function( elem ) {
    			return elem === docElem;
    		},

    		"focus": function( elem ) {
    			return elem === document.activeElement &&
    				( !document.hasFocus || document.hasFocus() ) &&
    				!!( elem.type || elem.href || ~elem.tabIndex );
    		},

    		// Boolean properties
    		"enabled": createDisabledPseudo( false ),
    		"disabled": createDisabledPseudo( true ),

    		"checked": function( elem ) {

    			// In CSS3, :checked should return both checked and selected elements
    			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
    			var nodeName = elem.nodeName.toLowerCase();
    			return ( nodeName === "input" && !!elem.checked ) ||
    				( nodeName === "option" && !!elem.selected );
    		},

    		"selected": function( elem ) {

    			// Accessing this property makes selected-by-default
    			// options in Safari work properly
    			if ( elem.parentNode ) {
    				// eslint-disable-next-line no-unused-expressions
    				elem.parentNode.selectedIndex;
    			}

    			return elem.selected === true;
    		},

    		// Contents
    		"empty": function( elem ) {

    			// http://www.w3.org/TR/selectors/#empty-pseudo
    			// :empty is negated by element (1) or content nodes (text: 3; cdata: 4; entity ref: 5),
    			//   but not by others (comment: 8; processing instruction: 7; etc.)
    			// nodeType < 6 works because attributes (2) do not appear as children
    			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
    				if ( elem.nodeType < 6 ) {
    					return false;
    				}
    			}
    			return true;
    		},

    		"parent": function( elem ) {
    			return !Expr.pseudos[ "empty" ]( elem );
    		},

    		// Element/input types
    		"header": function( elem ) {
    			return rheader.test( elem.nodeName );
    		},

    		"input": function( elem ) {
    			return rinputs.test( elem.nodeName );
    		},

    		"button": function( elem ) {
    			var name = elem.nodeName.toLowerCase();
    			return name === "input" && elem.type === "button" || name === "button";
    		},

    		"text": function( elem ) {
    			var attr;
    			return elem.nodeName.toLowerCase() === "input" &&
    				elem.type === "text" &&

    				// Support: IE<8
    				// New HTML5 attribute values (e.g., "search") appear with elem.type === "text"
    				( ( attr = elem.getAttribute( "type" ) ) == null ||
    					attr.toLowerCase() === "text" );
    		},

    		// Position-in-collection
    		"first": createPositionalPseudo( function() {
    			return [ 0 ];
    		} ),

    		"last": createPositionalPseudo( function( _matchIndexes, length ) {
    			return [ length - 1 ];
    		} ),

    		"eq": createPositionalPseudo( function( _matchIndexes, length, argument ) {
    			return [ argument < 0 ? argument + length : argument ];
    		} ),

    		"even": createPositionalPseudo( function( matchIndexes, length ) {
    			var i = 0;
    			for ( ; i < length; i += 2 ) {
    				matchIndexes.push( i );
    			}
    			return matchIndexes;
    		} ),

    		"odd": createPositionalPseudo( function( matchIndexes, length ) {
    			var i = 1;
    			for ( ; i < length; i += 2 ) {
    				matchIndexes.push( i );
    			}
    			return matchIndexes;
    		} ),

    		"lt": createPositionalPseudo( function( matchIndexes, length, argument ) {
    			var i = argument < 0 ?
    				argument + length :
    				argument > length ?
    					length :
    					argument;
    			for ( ; --i >= 0; ) {
    				matchIndexes.push( i );
    			}
    			return matchIndexes;
    		} ),

    		"gt": createPositionalPseudo( function( matchIndexes, length, argument ) {
    			var i = argument < 0 ? argument + length : argument;
    			for ( ; ++i < length; ) {
    				matchIndexes.push( i );
    			}
    			return matchIndexes;
    		} )
    	}
    };

    Expr.pseudos[ "nth" ] = Expr.pseudos[ "eq" ];

    // Add button/input type pseudos
    for ( i in { radio: true, checkbox: true, file: true, password: true, image: true } ) {
    	Expr.pseudos[ i ] = createInputPseudo( i );
    }
    for ( i in { submit: true, reset: true } ) {
    	Expr.pseudos[ i ] = createButtonPseudo( i );
    }

    // Easy API for creating new setFilters
    function setFilters() {}
    setFilters.prototype = Expr.filters = Expr.pseudos;
    Expr.setFilters = new setFilters();

    tokenize = Sizzle.tokenize = function( selector, parseOnly ) {
    	var matched, match, tokens, type,
    		soFar, groups, preFilters,
    		cached = tokenCache[ selector + " " ];

    	if ( cached ) {
    		return parseOnly ? 0 : cached.slice( 0 );
    	}

    	soFar = selector;
    	groups = [];
    	preFilters = Expr.preFilter;

    	while ( soFar ) {

    		// Comma and first run
    		if ( !matched || ( match = rcomma.exec( soFar ) ) ) {
    			if ( match ) {

    				// Don't consume trailing commas as valid
    				soFar = soFar.slice( match[ 0 ].length ) || soFar;
    			}
    			groups.push( ( tokens = [] ) );
    		}

    		matched = false;

    		// Combinators
    		if ( ( match = rcombinators.exec( soFar ) ) ) {
    			matched = match.shift();
    			tokens.push( {
    				value: matched,

    				// Cast descendant combinators to space
    				type: match[ 0 ].replace( rtrim, " " )
    			} );
    			soFar = soFar.slice( matched.length );
    		}

    		// Filters
    		for ( type in Expr.filter ) {
    			if ( ( match = matchExpr[ type ].exec( soFar ) ) && ( !preFilters[ type ] ||
    				( match = preFilters[ type ]( match ) ) ) ) {
    				matched = match.shift();
    				tokens.push( {
    					value: matched,
    					type: type,
    					matches: match
    				} );
    				soFar = soFar.slice( matched.length );
    			}
    		}

    		if ( !matched ) {
    			break;
    		}
    	}

    	// Return the length of the invalid excess
    	// if we're just parsing
    	// Otherwise, throw an error or return tokens
    	return parseOnly ?
    		soFar.length :
    		soFar ?
    			Sizzle.error( selector ) :

    			// Cache the tokens
    			tokenCache( selector, groups ).slice( 0 );
    };

    function toSelector( tokens ) {
    	var i = 0,
    		len = tokens.length,
    		selector = "";
    	for ( ; i < len; i++ ) {
    		selector += tokens[ i ].value;
    	}
    	return selector;
    }

    function addCombinator( matcher, combinator, base ) {
    	var dir = combinator.dir,
    		skip = combinator.next,
    		key = skip || dir,
    		checkNonElements = base && key === "parentNode",
    		doneName = done++;

    	return combinator.first ?

    		// Check against closest ancestor/preceding element
    		function( elem, context, xml ) {
    			while ( ( elem = elem[ dir ] ) ) {
    				if ( elem.nodeType === 1 || checkNonElements ) {
    					return matcher( elem, context, xml );
    				}
    			}
    			return false;
    		} :

    		// Check against all ancestor/preceding elements
    		function( elem, context, xml ) {
    			var oldCache, uniqueCache, outerCache,
    				newCache = [ dirruns, doneName ];

    			// We can't set arbitrary data on XML nodes, so they don't benefit from combinator caching
    			if ( xml ) {
    				while ( ( elem = elem[ dir ] ) ) {
    					if ( elem.nodeType === 1 || checkNonElements ) {
    						if ( matcher( elem, context, xml ) ) {
    							return true;
    						}
    					}
    				}
    			} else {
    				while ( ( elem = elem[ dir ] ) ) {
    					if ( elem.nodeType === 1 || checkNonElements ) {
    						outerCache = elem[ expando ] || ( elem[ expando ] = {} );

    						// Support: IE <9 only
    						// Defend against cloned attroperties (jQuery gh-1709)
    						uniqueCache = outerCache[ elem.uniqueID ] ||
    							( outerCache[ elem.uniqueID ] = {} );

    						if ( skip && skip === elem.nodeName.toLowerCase() ) {
    							elem = elem[ dir ] || elem;
    						} else if ( ( oldCache = uniqueCache[ key ] ) &&
    							oldCache[ 0 ] === dirruns && oldCache[ 1 ] === doneName ) {

    							// Assign to newCache so results back-propagate to previous elements
    							return ( newCache[ 2 ] = oldCache[ 2 ] );
    						} else {

    							// Reuse newcache so results back-propagate to previous elements
    							uniqueCache[ key ] = newCache;

    							// A match means we're done; a fail means we have to keep checking
    							if ( ( newCache[ 2 ] = matcher( elem, context, xml ) ) ) {
    								return true;
    							}
    						}
    					}
    				}
    			}
    			return false;
    		};
    }

    function elementMatcher( matchers ) {
    	return matchers.length > 1 ?
    		function( elem, context, xml ) {
    			var i = matchers.length;
    			while ( i-- ) {
    				if ( !matchers[ i ]( elem, context, xml ) ) {
    					return false;
    				}
    			}
    			return true;
    		} :
    		matchers[ 0 ];
    }

    function multipleContexts( selector, contexts, results ) {
    	var i = 0,
    		len = contexts.length;
    	for ( ; i < len; i++ ) {
    		Sizzle( selector, contexts[ i ], results );
    	}
    	return results;
    }

    function condense( unmatched, map, filter, context, xml ) {
    	var elem,
    		newUnmatched = [],
    		i = 0,
    		len = unmatched.length,
    		mapped = map != null;

    	for ( ; i < len; i++ ) {
    		if ( ( elem = unmatched[ i ] ) ) {
    			if ( !filter || filter( elem, context, xml ) ) {
    				newUnmatched.push( elem );
    				if ( mapped ) {
    					map.push( i );
    				}
    			}
    		}
    	}

    	return newUnmatched;
    }

    function setMatcher( preFilter, selector, matcher, postFilter, postFinder, postSelector ) {
    	if ( postFilter && !postFilter[ expando ] ) {
    		postFilter = setMatcher( postFilter );
    	}
    	if ( postFinder && !postFinder[ expando ] ) {
    		postFinder = setMatcher( postFinder, postSelector );
    	}
    	return markFunction( function( seed, results, context, xml ) {
    		var temp, i, elem,
    			preMap = [],
    			postMap = [],
    			preexisting = results.length,

    			// Get initial elements from seed or context
    			elems = seed || multipleContexts(
    				selector || "*",
    				context.nodeType ? [ context ] : context,
    				[]
    			),

    			// Prefilter to get matcher input, preserving a map for seed-results synchronization
    			matcherIn = preFilter && ( seed || !selector ) ?
    				condense( elems, preMap, preFilter, context, xml ) :
    				elems,

    			matcherOut = matcher ?

    				// If we have a postFinder, or filtered seed, or non-seed postFilter or preexisting results,
    				postFinder || ( seed ? preFilter : preexisting || postFilter ) ?

    					// ...intermediate processing is necessary
    					[] :

    					// ...otherwise use results directly
    					results :
    				matcherIn;

    		// Find primary matches
    		if ( matcher ) {
    			matcher( matcherIn, matcherOut, context, xml );
    		}

    		// Apply postFilter
    		if ( postFilter ) {
    			temp = condense( matcherOut, postMap );
    			postFilter( temp, [], context, xml );

    			// Un-match failing elements by moving them back to matcherIn
    			i = temp.length;
    			while ( i-- ) {
    				if ( ( elem = temp[ i ] ) ) {
    					matcherOut[ postMap[ i ] ] = !( matcherIn[ postMap[ i ] ] = elem );
    				}
    			}
    		}

    		if ( seed ) {
    			if ( postFinder || preFilter ) {
    				if ( postFinder ) {

    					// Get the final matcherOut by condensing this intermediate into postFinder contexts
    					temp = [];
    					i = matcherOut.length;
    					while ( i-- ) {
    						if ( ( elem = matcherOut[ i ] ) ) {

    							// Restore matcherIn since elem is not yet a final match
    							temp.push( ( matcherIn[ i ] = elem ) );
    						}
    					}
    					postFinder( null, ( matcherOut = [] ), temp, xml );
    				}

    				// Move matched elements from seed to results to keep them synchronized
    				i = matcherOut.length;
    				while ( i-- ) {
    					if ( ( elem = matcherOut[ i ] ) &&
    						( temp = postFinder ? indexOf( seed, elem ) : preMap[ i ] ) > -1 ) {

    						seed[ temp ] = !( results[ temp ] = elem );
    					}
    				}
    			}

    		// Add elements to results, through postFinder if defined
    		} else {
    			matcherOut = condense(
    				matcherOut === results ?
    					matcherOut.splice( preexisting, matcherOut.length ) :
    					matcherOut
    			);
    			if ( postFinder ) {
    				postFinder( null, results, matcherOut, xml );
    			} else {
    				push.apply( results, matcherOut );
    			}
    		}
    	} );
    }

    function matcherFromTokens( tokens ) {
    	var checkContext, matcher, j,
    		len = tokens.length,
    		leadingRelative = Expr.relative[ tokens[ 0 ].type ],
    		implicitRelative = leadingRelative || Expr.relative[ " " ],
    		i = leadingRelative ? 1 : 0,

    		// The foundational matcher ensures that elements are reachable from top-level context(s)
    		matchContext = addCombinator( function( elem ) {
    			return elem === checkContext;
    		}, implicitRelative, true ),
    		matchAnyContext = addCombinator( function( elem ) {
    			return indexOf( checkContext, elem ) > -1;
    		}, implicitRelative, true ),
    		matchers = [ function( elem, context, xml ) {
    			var ret = ( !leadingRelative && ( xml || context !== outermostContext ) ) || (
    				( checkContext = context ).nodeType ?
    					matchContext( elem, context, xml ) :
    					matchAnyContext( elem, context, xml ) );

    			// Avoid hanging onto element (issue #299)
    			checkContext = null;
    			return ret;
    		} ];

    	for ( ; i < len; i++ ) {
    		if ( ( matcher = Expr.relative[ tokens[ i ].type ] ) ) {
    			matchers = [ addCombinator( elementMatcher( matchers ), matcher ) ];
    		} else {
    			matcher = Expr.filter[ tokens[ i ].type ].apply( null, tokens[ i ].matches );

    			// Return special upon seeing a positional matcher
    			if ( matcher[ expando ] ) {

    				// Find the next relative operator (if any) for proper handling
    				j = ++i;
    				for ( ; j < len; j++ ) {
    					if ( Expr.relative[ tokens[ j ].type ] ) {
    						break;
    					}
    				}
    				return setMatcher(
    					i > 1 && elementMatcher( matchers ),
    					i > 1 && toSelector(

    					// If the preceding token was a descendant combinator, insert an implicit any-element `*`
    					tokens
    						.slice( 0, i - 1 )
    						.concat( { value: tokens[ i - 2 ].type === " " ? "*" : "" } )
    					).replace( rtrim, "$1" ),
    					matcher,
    					i < j && matcherFromTokens( tokens.slice( i, j ) ),
    					j < len && matcherFromTokens( ( tokens = tokens.slice( j ) ) ),
    					j < len && toSelector( tokens )
    				);
    			}
    			matchers.push( matcher );
    		}
    	}

    	return elementMatcher( matchers );
    }

    function matcherFromGroupMatchers( elementMatchers, setMatchers ) {
    	var bySet = setMatchers.length > 0,
    		byElement = elementMatchers.length > 0,
    		superMatcher = function( seed, context, xml, results, outermost ) {
    			var elem, j, matcher,
    				matchedCount = 0,
    				i = "0",
    				unmatched = seed && [],
    				setMatched = [],
    				contextBackup = outermostContext,

    				// We must always have either seed elements or outermost context
    				elems = seed || byElement && Expr.find[ "TAG" ]( "*", outermost ),

    				// Use integer dirruns iff this is the outermost matcher
    				dirrunsUnique = ( dirruns += contextBackup == null ? 1 : Math.random() || 0.1 ),
    				len = elems.length;

    			if ( outermost ) {

    				// Support: IE 11+, Edge 17 - 18+
    				// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
    				// two documents; shallow comparisons work.
    				// eslint-disable-next-line eqeqeq
    				outermostContext = context == document || context || outermost;
    			}

    			// Add elements passing elementMatchers directly to results
    			// Support: IE<9, Safari
    			// Tolerate NodeList properties (IE: "length"; Safari: <number>) matching elements by id
    			for ( ; i !== len && ( elem = elems[ i ] ) != null; i++ ) {
    				if ( byElement && elem ) {
    					j = 0;

    					// Support: IE 11+, Edge 17 - 18+
    					// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
    					// two documents; shallow comparisons work.
    					// eslint-disable-next-line eqeqeq
    					if ( !context && elem.ownerDocument != document ) {
    						setDocument( elem );
    						xml = !documentIsHTML;
    					}
    					while ( ( matcher = elementMatchers[ j++ ] ) ) {
    						if ( matcher( elem, context || document, xml ) ) {
    							results.push( elem );
    							break;
    						}
    					}
    					if ( outermost ) {
    						dirruns = dirrunsUnique;
    					}
    				}

    				// Track unmatched elements for set filters
    				if ( bySet ) {

    					// They will have gone through all possible matchers
    					if ( ( elem = !matcher && elem ) ) {
    						matchedCount--;
    					}

    					// Lengthen the array for every element, matched or not
    					if ( seed ) {
    						unmatched.push( elem );
    					}
    				}
    			}

    			// `i` is now the count of elements visited above, and adding it to `matchedCount`
    			// makes the latter nonnegative.
    			matchedCount += i;

    			// Apply set filters to unmatched elements
    			// NOTE: This can be skipped if there are no unmatched elements (i.e., `matchedCount`
    			// equals `i`), unless we didn't visit _any_ elements in the above loop because we have
    			// no element matchers and no seed.
    			// Incrementing an initially-string "0" `i` allows `i` to remain a string only in that
    			// case, which will result in a "00" `matchedCount` that differs from `i` but is also
    			// numerically zero.
    			if ( bySet && i !== matchedCount ) {
    				j = 0;
    				while ( ( matcher = setMatchers[ j++ ] ) ) {
    					matcher( unmatched, setMatched, context, xml );
    				}

    				if ( seed ) {

    					// Reintegrate element matches to eliminate the need for sorting
    					if ( matchedCount > 0 ) {
    						while ( i-- ) {
    							if ( !( unmatched[ i ] || setMatched[ i ] ) ) {
    								setMatched[ i ] = pop.call( results );
    							}
    						}
    					}

    					// Discard index placeholder values to get only actual matches
    					setMatched = condense( setMatched );
    				}

    				// Add matches to results
    				push.apply( results, setMatched );

    				// Seedless set matches succeeding multiple successful matchers stipulate sorting
    				if ( outermost && !seed && setMatched.length > 0 &&
    					( matchedCount + setMatchers.length ) > 1 ) {

    					Sizzle.uniqueSort( results );
    				}
    			}

    			// Override manipulation of globals by nested matchers
    			if ( outermost ) {
    				dirruns = dirrunsUnique;
    				outermostContext = contextBackup;
    			}

    			return unmatched;
    		};

    	return bySet ?
    		markFunction( superMatcher ) :
    		superMatcher;
    }

    compile = Sizzle.compile = function( selector, match /* Internal Use Only */ ) {
    	var i,
    		setMatchers = [],
    		elementMatchers = [],
    		cached = compilerCache[ selector + " " ];

    	if ( !cached ) {

    		// Generate a function of recursive functions that can be used to check each element
    		if ( !match ) {
    			match = tokenize( selector );
    		}
    		i = match.length;
    		while ( i-- ) {
    			cached = matcherFromTokens( match[ i ] );
    			if ( cached[ expando ] ) {
    				setMatchers.push( cached );
    			} else {
    				elementMatchers.push( cached );
    			}
    		}

    		// Cache the compiled function
    		cached = compilerCache(
    			selector,
    			matcherFromGroupMatchers( elementMatchers, setMatchers )
    		);

    		// Save selector and tokenization
    		cached.selector = selector;
    	}
    	return cached;
    };

    /**
     * A low-level selection function that works with Sizzle's compiled
     *  selector functions
     * @param {String|Function} selector A selector or a pre-compiled
     *  selector function built with Sizzle.compile
     * @param {Element} context
     * @param {Array} [results]
     * @param {Array} [seed] A set of elements to match against
     */
    select = Sizzle.select = function( selector, context, results, seed ) {
    	var i, tokens, token, type, find,
    		compiled = typeof selector === "function" && selector,
    		match = !seed && tokenize( ( selector = compiled.selector || selector ) );

    	results = results || [];

    	// Try to minimize operations if there is only one selector in the list and no seed
    	// (the latter of which guarantees us context)
    	if ( match.length === 1 ) {

    		// Reduce context if the leading compound selector is an ID
    		tokens = match[ 0 ] = match[ 0 ].slice( 0 );
    		if ( tokens.length > 2 && ( token = tokens[ 0 ] ).type === "ID" &&
    			context.nodeType === 9 && documentIsHTML && Expr.relative[ tokens[ 1 ].type ] ) {

    			context = ( Expr.find[ "ID" ]( token.matches[ 0 ]
    				.replace( runescape, funescape ), context ) || [] )[ 0 ];
    			if ( !context ) {
    				return results;

    			// Precompiled matchers will still verify ancestry, so step up a level
    			} else if ( compiled ) {
    				context = context.parentNode;
    			}

    			selector = selector.slice( tokens.shift().value.length );
    		}

    		// Fetch a seed set for right-to-left matching
    		i = matchExpr[ "needsContext" ].test( selector ) ? 0 : tokens.length;
    		while ( i-- ) {
    			token = tokens[ i ];

    			// Abort if we hit a combinator
    			if ( Expr.relative[ ( type = token.type ) ] ) {
    				break;
    			}
    			if ( ( find = Expr.find[ type ] ) ) {

    				// Search, expanding context for leading sibling combinators
    				if ( ( seed = find(
    					token.matches[ 0 ].replace( runescape, funescape ),
    					rsibling.test( tokens[ 0 ].type ) && testContext( context.parentNode ) ||
    						context
    				) ) ) {

    					// If seed is empty or no tokens remain, we can return early
    					tokens.splice( i, 1 );
    					selector = seed.length && toSelector( tokens );
    					if ( !selector ) {
    						push.apply( results, seed );
    						return results;
    					}

    					break;
    				}
    			}
    		}
    	}

    	// Compile and execute a filtering function if one is not provided
    	// Provide `match` to avoid retokenization if we modified the selector above
    	( compiled || compile( selector, match ) )(
    		seed,
    		context,
    		!documentIsHTML,
    		results,
    		!context || rsibling.test( selector ) && testContext( context.parentNode ) || context
    	);
    	return results;
    };

    // One-time assignments

    // Sort stability
    support.sortStable = expando.split( "" ).sort( sortOrder ).join( "" ) === expando;

    // Support: Chrome 14-35+
    // Always assume duplicates if they aren't passed to the comparison function
    support.detectDuplicates = !!hasDuplicate;

    // Initialize against the default document
    setDocument();

    // Support: Webkit<537.32 - Safari 6.0.3/Chrome 25 (fixed in Chrome 27)
    // Detached nodes confoundingly follow *each other*
    support.sortDetached = assert( function( el ) {

    	// Should return 1, but returns 4 (following)
    	return el.compareDocumentPosition( document.createElement( "fieldset" ) ) & 1;
    } );

    // Support: IE<8
    // Prevent attribute/property "interpolation"
    // https://msdn.microsoft.com/en-us/library/ms536429%28VS.85%29.aspx
    if ( !assert( function( el ) {
    	el.innerHTML = "<a href='#'></a>";
    	return el.firstChild.getAttribute( "href" ) === "#";
    } ) ) {
    	addHandle( "type|href|height|width", function( elem, name, isXML ) {
    		if ( !isXML ) {
    			return elem.getAttribute( name, name.toLowerCase() === "type" ? 1 : 2 );
    		}
    	} );
    }

    // Support: IE<9
    // Use defaultValue in place of getAttribute("value")
    if ( !support.attributes || !assert( function( el ) {
    	el.innerHTML = "<input/>";
    	el.firstChild.setAttribute( "value", "" );
    	return el.firstChild.getAttribute( "value" ) === "";
    } ) ) {
    	addHandle( "value", function( elem, _name, isXML ) {
    		if ( !isXML && elem.nodeName.toLowerCase() === "input" ) {
    			return elem.defaultValue;
    		}
    	} );
    }

    // Support: IE<9
    // Use getAttributeNode to fetch booleans when getAttribute lies
    if ( !assert( function( el ) {
    	return el.getAttribute( "disabled" ) == null;
    } ) ) {
    	addHandle( booleans, function( elem, name, isXML ) {
    		var val;
    		if ( !isXML ) {
    			return elem[ name ] === true ? name.toLowerCase() :
    				( val = elem.getAttributeNode( name ) ) && val.specified ?
    					val.value :
    					null;
    		}
    	} );
    }

    return Sizzle;

    } )( window );



    jQuery.find = Sizzle;
    jQuery.expr = Sizzle.selectors;

    // Deprecated
    jQuery.expr[ ":" ] = jQuery.expr.pseudos;
    jQuery.uniqueSort = jQuery.unique = Sizzle.uniqueSort;
    jQuery.text = Sizzle.getText;
    jQuery.isXMLDoc = Sizzle.isXML;
    jQuery.contains = Sizzle.contains;
    jQuery.escapeSelector = Sizzle.escape;




    var dir = function( elem, dir, until ) {
    	var matched = [],
    		truncate = until !== undefined;

    	while ( ( elem = elem[ dir ] ) && elem.nodeType !== 9 ) {
    		if ( elem.nodeType === 1 ) {
    			if ( truncate && jQuery( elem ).is( until ) ) {
    				break;
    			}
    			matched.push( elem );
    		}
    	}
    	return matched;
    };


    var siblings = function( n, elem ) {
    	var matched = [];

    	for ( ; n; n = n.nextSibling ) {
    		if ( n.nodeType === 1 && n !== elem ) {
    			matched.push( n );
    		}
    	}

    	return matched;
    };


    var rneedsContext = jQuery.expr.match.needsContext;



    function nodeName( elem, name ) {

    	return elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase();

    }
    var rsingleTag = ( /^<([a-z][^\/\0>:\x20\t\r\n\f]*)[\x20\t\r\n\f]*\/?>(?:<\/\1>|)$/i );



    // Implement the identical functionality for filter and not
    function winnow( elements, qualifier, not ) {
    	if ( isFunction( qualifier ) ) {
    		return jQuery.grep( elements, function( elem, i ) {
    			return !!qualifier.call( elem, i, elem ) !== not;
    		} );
    	}

    	// Single element
    	if ( qualifier.nodeType ) {
    		return jQuery.grep( elements, function( elem ) {
    			return ( elem === qualifier ) !== not;
    		} );
    	}

    	// Arraylike of elements (jQuery, arguments, Array)
    	if ( typeof qualifier !== "string" ) {
    		return jQuery.grep( elements, function( elem ) {
    			return ( indexOf.call( qualifier, elem ) > -1 ) !== not;
    		} );
    	}

    	// Filtered directly for both simple and complex selectors
    	return jQuery.filter( qualifier, elements, not );
    }

    jQuery.filter = function( expr, elems, not ) {
    	var elem = elems[ 0 ];

    	if ( not ) {
    		expr = ":not(" + expr + ")";
    	}

    	if ( elems.length === 1 && elem.nodeType === 1 ) {
    		return jQuery.find.matchesSelector( elem, expr ) ? [ elem ] : [];
    	}

    	return jQuery.find.matches( expr, jQuery.grep( elems, function( elem ) {
    		return elem.nodeType === 1;
    	} ) );
    };

    jQuery.fn.extend( {
    	find: function( selector ) {
    		var i, ret,
    			len = this.length,
    			self = this;

    		if ( typeof selector !== "string" ) {
    			return this.pushStack( jQuery( selector ).filter( function() {
    				for ( i = 0; i < len; i++ ) {
    					if ( jQuery.contains( self[ i ], this ) ) {
    						return true;
    					}
    				}
    			} ) );
    		}

    		ret = this.pushStack( [] );

    		for ( i = 0; i < len; i++ ) {
    			jQuery.find( selector, self[ i ], ret );
    		}

    		return len > 1 ? jQuery.uniqueSort( ret ) : ret;
    	},
    	filter: function( selector ) {
    		return this.pushStack( winnow( this, selector || [], false ) );
    	},
    	not: function( selector ) {
    		return this.pushStack( winnow( this, selector || [], true ) );
    	},
    	is: function( selector ) {
    		return !!winnow(
    			this,

    			// If this is a positional/relative selector, check membership in the returned set
    			// so $("p:first").is("p:last") won't return true for a doc with two "p".
    			typeof selector === "string" && rneedsContext.test( selector ) ?
    				jQuery( selector ) :
    				selector || [],
    			false
    		).length;
    	}
    } );


    // Initialize a jQuery object


    // A central reference to the root jQuery(document)
    var rootjQuery,

    	// A simple way to check for HTML strings
    	// Prioritize #id over <tag> to avoid XSS via location.hash (#9521)
    	// Strict HTML recognition (#11290: must start with <)
    	// Shortcut simple #id case for speed
    	rquickExpr = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]+))$/,

    	init = jQuery.fn.init = function( selector, context, root ) {
    		var match, elem;

    		// HANDLE: $(""), $(null), $(undefined), $(false)
    		if ( !selector ) {
    			return this;
    		}

    		// Method init() accepts an alternate rootjQuery
    		// so migrate can support jQuery.sub (gh-2101)
    		root = root || rootjQuery;

    		// Handle HTML strings
    		if ( typeof selector === "string" ) {
    			if ( selector[ 0 ] === "<" &&
    				selector[ selector.length - 1 ] === ">" &&
    				selector.length >= 3 ) {

    				// Assume that strings that start and end with <> are HTML and skip the regex check
    				match = [ null, selector, null ];

    			} else {
    				match = rquickExpr.exec( selector );
    			}

    			// Match html or make sure no context is specified for #id
    			if ( match && ( match[ 1 ] || !context ) ) {

    				// HANDLE: $(html) -> $(array)
    				if ( match[ 1 ] ) {
    					context = context instanceof jQuery ? context[ 0 ] : context;

    					// Option to run scripts is true for back-compat
    					// Intentionally let the error be thrown if parseHTML is not present
    					jQuery.merge( this, jQuery.parseHTML(
    						match[ 1 ],
    						context && context.nodeType ? context.ownerDocument || context : document,
    						true
    					) );

    					// HANDLE: $(html, props)
    					if ( rsingleTag.test( match[ 1 ] ) && jQuery.isPlainObject( context ) ) {
    						for ( match in context ) {

    							// Properties of context are called as methods if possible
    							if ( isFunction( this[ match ] ) ) {
    								this[ match ]( context[ match ] );

    							// ...and otherwise set as attributes
    							} else {
    								this.attr( match, context[ match ] );
    							}
    						}
    					}

    					return this;

    				// HANDLE: $(#id)
    				} else {
    					elem = document.getElementById( match[ 2 ] );

    					if ( elem ) {

    						// Inject the element directly into the jQuery object
    						this[ 0 ] = elem;
    						this.length = 1;
    					}
    					return this;
    				}

    			// HANDLE: $(expr, $(...))
    			} else if ( !context || context.jquery ) {
    				return ( context || root ).find( selector );

    			// HANDLE: $(expr, context)
    			// (which is just equivalent to: $(context).find(expr)
    			} else {
    				return this.constructor( context ).find( selector );
    			}

    		// HANDLE: $(DOMElement)
    		} else if ( selector.nodeType ) {
    			this[ 0 ] = selector;
    			this.length = 1;
    			return this;

    		// HANDLE: $(function)
    		// Shortcut for document ready
    		} else if ( isFunction( selector ) ) {
    			return root.ready !== undefined ?
    				root.ready( selector ) :

    				// Execute immediately if ready is not present
    				selector( jQuery );
    		}

    		return jQuery.makeArray( selector, this );
    	};

    // Give the init function the jQuery prototype for later instantiation
    init.prototype = jQuery.fn;

    // Initialize central reference
    rootjQuery = jQuery( document );


    var rparentsprev = /^(?:parents|prev(?:Until|All))/,

    	// Methods guaranteed to produce a unique set when starting from a unique set
    	guaranteedUnique = {
    		children: true,
    		contents: true,
    		next: true,
    		prev: true
    	};

    jQuery.fn.extend( {
    	has: function( target ) {
    		var targets = jQuery( target, this ),
    			l = targets.length;

    		return this.filter( function() {
    			var i = 0;
    			for ( ; i < l; i++ ) {
    				if ( jQuery.contains( this, targets[ i ] ) ) {
    					return true;
    				}
    			}
    		} );
    	},

    	closest: function( selectors, context ) {
    		var cur,
    			i = 0,
    			l = this.length,
    			matched = [],
    			targets = typeof selectors !== "string" && jQuery( selectors );

    		// Positional selectors never match, since there's no _selection_ context
    		if ( !rneedsContext.test( selectors ) ) {
    			for ( ; i < l; i++ ) {
    				for ( cur = this[ i ]; cur && cur !== context; cur = cur.parentNode ) {

    					// Always skip document fragments
    					if ( cur.nodeType < 11 && ( targets ?
    						targets.index( cur ) > -1 :

    						// Don't pass non-elements to Sizzle
    						cur.nodeType === 1 &&
    							jQuery.find.matchesSelector( cur, selectors ) ) ) {

    						matched.push( cur );
    						break;
    					}
    				}
    			}
    		}

    		return this.pushStack( matched.length > 1 ? jQuery.uniqueSort( matched ) : matched );
    	},

    	// Determine the position of an element within the set
    	index: function( elem ) {

    		// No argument, return index in parent
    		if ( !elem ) {
    			return ( this[ 0 ] && this[ 0 ].parentNode ) ? this.first().prevAll().length : -1;
    		}

    		// Index in selector
    		if ( typeof elem === "string" ) {
    			return indexOf.call( jQuery( elem ), this[ 0 ] );
    		}

    		// Locate the position of the desired element
    		return indexOf.call( this,

    			// If it receives a jQuery object, the first element is used
    			elem.jquery ? elem[ 0 ] : elem
    		);
    	},

    	add: function( selector, context ) {
    		return this.pushStack(
    			jQuery.uniqueSort(
    				jQuery.merge( this.get(), jQuery( selector, context ) )
    			)
    		);
    	},

    	addBack: function( selector ) {
    		return this.add( selector == null ?
    			this.prevObject : this.prevObject.filter( selector )
    		);
    	}
    } );

    function sibling( cur, dir ) {
    	while ( ( cur = cur[ dir ] ) && cur.nodeType !== 1 ) {}
    	return cur;
    }

    jQuery.each( {
    	parent: function( elem ) {
    		var parent = elem.parentNode;
    		return parent && parent.nodeType !== 11 ? parent : null;
    	},
    	parents: function( elem ) {
    		return dir( elem, "parentNode" );
    	},
    	parentsUntil: function( elem, _i, until ) {
    		return dir( elem, "parentNode", until );
    	},
    	next: function( elem ) {
    		return sibling( elem, "nextSibling" );
    	},
    	prev: function( elem ) {
    		return sibling( elem, "previousSibling" );
    	},
    	nextAll: function( elem ) {
    		return dir( elem, "nextSibling" );
    	},
    	prevAll: function( elem ) {
    		return dir( elem, "previousSibling" );
    	},
    	nextUntil: function( elem, _i, until ) {
    		return dir( elem, "nextSibling", until );
    	},
    	prevUntil: function( elem, _i, until ) {
    		return dir( elem, "previousSibling", until );
    	},
    	siblings: function( elem ) {
    		return siblings( ( elem.parentNode || {} ).firstChild, elem );
    	},
    	children: function( elem ) {
    		return siblings( elem.firstChild );
    	},
    	contents: function( elem ) {
    		if ( elem.contentDocument != null &&

    			// Support: IE 11+
    			// <object> elements with no `data` attribute has an object
    			// `contentDocument` with a `null` prototype.
    			getProto( elem.contentDocument ) ) {

    			return elem.contentDocument;
    		}

    		// Support: IE 9 - 11 only, iOS 7 only, Android Browser <=4.3 only
    		// Treat the template element as a regular one in browsers that
    		// don't support it.
    		if ( nodeName( elem, "template" ) ) {
    			elem = elem.content || elem;
    		}

    		return jQuery.merge( [], elem.childNodes );
    	}
    }, function( name, fn ) {
    	jQuery.fn[ name ] = function( until, selector ) {
    		var matched = jQuery.map( this, fn, until );

    		if ( name.slice( -5 ) !== "Until" ) {
    			selector = until;
    		}

    		if ( selector && typeof selector === "string" ) {
    			matched = jQuery.filter( selector, matched );
    		}

    		if ( this.length > 1 ) {

    			// Remove duplicates
    			if ( !guaranteedUnique[ name ] ) {
    				jQuery.uniqueSort( matched );
    			}

    			// Reverse order for parents* and prev-derivatives
    			if ( rparentsprev.test( name ) ) {
    				matched.reverse();
    			}
    		}

    		return this.pushStack( matched );
    	};
    } );
    var rnothtmlwhite = ( /[^\x20\t\r\n\f]+/g );



    // Convert String-formatted options into Object-formatted ones
    function createOptions( options ) {
    	var object = {};
    	jQuery.each( options.match( rnothtmlwhite ) || [], function( _, flag ) {
    		object[ flag ] = true;
    	} );
    	return object;
    }

    /*
     * Create a callback list using the following parameters:
     *
     *	options: an optional list of space-separated options that will change how
     *			the callback list behaves or a more traditional option object
     *
     * By default a callback list will act like an event callback list and can be
     * "fired" multiple times.
     *
     * Possible options:
     *
     *	once:			will ensure the callback list can only be fired once (like a Deferred)
     *
     *	memory:			will keep track of previous values and will call any callback added
     *					after the list has been fired right away with the latest "memorized"
     *					values (like a Deferred)
     *
     *	unique:			will ensure a callback can only be added once (no duplicate in the list)
     *
     *	stopOnFalse:	interrupt callings when a callback returns false
     *
     */
    jQuery.Callbacks = function( options ) {

    	// Convert options from String-formatted to Object-formatted if needed
    	// (we check in cache first)
    	options = typeof options === "string" ?
    		createOptions( options ) :
    		jQuery.extend( {}, options );

    	var // Flag to know if list is currently firing
    		firing,

    		// Last fire value for non-forgettable lists
    		memory,

    		// Flag to know if list was already fired
    		fired,

    		// Flag to prevent firing
    		locked,

    		// Actual callback list
    		list = [],

    		// Queue of execution data for repeatable lists
    		queue = [],

    		// Index of currently firing callback (modified by add/remove as needed)
    		firingIndex = -1,

    		// Fire callbacks
    		fire = function() {

    			// Enforce single-firing
    			locked = locked || options.once;

    			// Execute callbacks for all pending executions,
    			// respecting firingIndex overrides and runtime changes
    			fired = firing = true;
    			for ( ; queue.length; firingIndex = -1 ) {
    				memory = queue.shift();
    				while ( ++firingIndex < list.length ) {

    					// Run callback and check for early termination
    					if ( list[ firingIndex ].apply( memory[ 0 ], memory[ 1 ] ) === false &&
    						options.stopOnFalse ) {

    						// Jump to end and forget the data so .add doesn't re-fire
    						firingIndex = list.length;
    						memory = false;
    					}
    				}
    			}

    			// Forget the data if we're done with it
    			if ( !options.memory ) {
    				memory = false;
    			}

    			firing = false;

    			// Clean up if we're done firing for good
    			if ( locked ) {

    				// Keep an empty list if we have data for future add calls
    				if ( memory ) {
    					list = [];

    				// Otherwise, this object is spent
    				} else {
    					list = "";
    				}
    			}
    		},

    		// Actual Callbacks object
    		self = {

    			// Add a callback or a collection of callbacks to the list
    			add: function() {
    				if ( list ) {

    					// If we have memory from a past run, we should fire after adding
    					if ( memory && !firing ) {
    						firingIndex = list.length - 1;
    						queue.push( memory );
    					}

    					( function add( args ) {
    						jQuery.each( args, function( _, arg ) {
    							if ( isFunction( arg ) ) {
    								if ( !options.unique || !self.has( arg ) ) {
    									list.push( arg );
    								}
    							} else if ( arg && arg.length && toType( arg ) !== "string" ) {

    								// Inspect recursively
    								add( arg );
    							}
    						} );
    					} )( arguments );

    					if ( memory && !firing ) {
    						fire();
    					}
    				}
    				return this;
    			},

    			// Remove a callback from the list
    			remove: function() {
    				jQuery.each( arguments, function( _, arg ) {
    					var index;
    					while ( ( index = jQuery.inArray( arg, list, index ) ) > -1 ) {
    						list.splice( index, 1 );

    						// Handle firing indexes
    						if ( index <= firingIndex ) {
    							firingIndex--;
    						}
    					}
    				} );
    				return this;
    			},

    			// Check if a given callback is in the list.
    			// If no argument is given, return whether or not list has callbacks attached.
    			has: function( fn ) {
    				return fn ?
    					jQuery.inArray( fn, list ) > -1 :
    					list.length > 0;
    			},

    			// Remove all callbacks from the list
    			empty: function() {
    				if ( list ) {
    					list = [];
    				}
    				return this;
    			},

    			// Disable .fire and .add
    			// Abort any current/pending executions
    			// Clear all callbacks and values
    			disable: function() {
    				locked = queue = [];
    				list = memory = "";
    				return this;
    			},
    			disabled: function() {
    				return !list;
    			},

    			// Disable .fire
    			// Also disable .add unless we have memory (since it would have no effect)
    			// Abort any pending executions
    			lock: function() {
    				locked = queue = [];
    				if ( !memory && !firing ) {
    					list = memory = "";
    				}
    				return this;
    			},
    			locked: function() {
    				return !!locked;
    			},

    			// Call all callbacks with the given context and arguments
    			fireWith: function( context, args ) {
    				if ( !locked ) {
    					args = args || [];
    					args = [ context, args.slice ? args.slice() : args ];
    					queue.push( args );
    					if ( !firing ) {
    						fire();
    					}
    				}
    				return this;
    			},

    			// Call all the callbacks with the given arguments
    			fire: function() {
    				self.fireWith( this, arguments );
    				return this;
    			},

    			// To know if the callbacks have already been called at least once
    			fired: function() {
    				return !!fired;
    			}
    		};

    	return self;
    };


    function Identity( v ) {
    	return v;
    }
    function Thrower( ex ) {
    	throw ex;
    }

    function adoptValue( value, resolve, reject, noValue ) {
    	var method;

    	try {

    		// Check for promise aspect first to privilege synchronous behavior
    		if ( value && isFunction( ( method = value.promise ) ) ) {
    			method.call( value ).done( resolve ).fail( reject );

    		// Other thenables
    		} else if ( value && isFunction( ( method = value.then ) ) ) {
    			method.call( value, resolve, reject );

    		// Other non-thenables
    		} else {

    			// Control `resolve` arguments by letting Array#slice cast boolean `noValue` to integer:
    			// * false: [ value ].slice( 0 ) => resolve( value )
    			// * true: [ value ].slice( 1 ) => resolve()
    			resolve.apply( undefined, [ value ].slice( noValue ) );
    		}

    	// For Promises/A+, convert exceptions into rejections
    	// Since jQuery.when doesn't unwrap thenables, we can skip the extra checks appearing in
    	// Deferred#then to conditionally suppress rejection.
    	} catch ( value ) {

    		// Support: Android 4.0 only
    		// Strict mode functions invoked without .call/.apply get global-object context
    		reject.apply( undefined, [ value ] );
    	}
    }

    jQuery.extend( {

    	Deferred: function( func ) {
    		var tuples = [

    				// action, add listener, callbacks,
    				// ... .then handlers, argument index, [final state]
    				[ "notify", "progress", jQuery.Callbacks( "memory" ),
    					jQuery.Callbacks( "memory" ), 2 ],
    				[ "resolve", "done", jQuery.Callbacks( "once memory" ),
    					jQuery.Callbacks( "once memory" ), 0, "resolved" ],
    				[ "reject", "fail", jQuery.Callbacks( "once memory" ),
    					jQuery.Callbacks( "once memory" ), 1, "rejected" ]
    			],
    			state = "pending",
    			promise = {
    				state: function() {
    					return state;
    				},
    				always: function() {
    					deferred.done( arguments ).fail( arguments );
    					return this;
    				},
    				"catch": function( fn ) {
    					return promise.then( null, fn );
    				},

    				// Keep pipe for back-compat
    				pipe: function( /* fnDone, fnFail, fnProgress */ ) {
    					var fns = arguments;

    					return jQuery.Deferred( function( newDefer ) {
    						jQuery.each( tuples, function( _i, tuple ) {

    							// Map tuples (progress, done, fail) to arguments (done, fail, progress)
    							var fn = isFunction( fns[ tuple[ 4 ] ] ) && fns[ tuple[ 4 ] ];

    							// deferred.progress(function() { bind to newDefer or newDefer.notify })
    							// deferred.done(function() { bind to newDefer or newDefer.resolve })
    							// deferred.fail(function() { bind to newDefer or newDefer.reject })
    							deferred[ tuple[ 1 ] ]( function() {
    								var returned = fn && fn.apply( this, arguments );
    								if ( returned && isFunction( returned.promise ) ) {
    									returned.promise()
    										.progress( newDefer.notify )
    										.done( newDefer.resolve )
    										.fail( newDefer.reject );
    								} else {
    									newDefer[ tuple[ 0 ] + "With" ](
    										this,
    										fn ? [ returned ] : arguments
    									);
    								}
    							} );
    						} );
    						fns = null;
    					} ).promise();
    				},
    				then: function( onFulfilled, onRejected, onProgress ) {
    					var maxDepth = 0;
    					function resolve( depth, deferred, handler, special ) {
    						return function() {
    							var that = this,
    								args = arguments,
    								mightThrow = function() {
    									var returned, then;

    									// Support: Promises/A+ section 2.3.3.3.3
    									// https://promisesaplus.com/#point-59
    									// Ignore double-resolution attempts
    									if ( depth < maxDepth ) {
    										return;
    									}

    									returned = handler.apply( that, args );

    									// Support: Promises/A+ section 2.3.1
    									// https://promisesaplus.com/#point-48
    									if ( returned === deferred.promise() ) {
    										throw new TypeError( "Thenable self-resolution" );
    									}

    									// Support: Promises/A+ sections 2.3.3.1, 3.5
    									// https://promisesaplus.com/#point-54
    									// https://promisesaplus.com/#point-75
    									// Retrieve `then` only once
    									then = returned &&

    										// Support: Promises/A+ section 2.3.4
    										// https://promisesaplus.com/#point-64
    										// Only check objects and functions for thenability
    										( typeof returned === "object" ||
    											typeof returned === "function" ) &&
    										returned.then;

    									// Handle a returned thenable
    									if ( isFunction( then ) ) {

    										// Special processors (notify) just wait for resolution
    										if ( special ) {
    											then.call(
    												returned,
    												resolve( maxDepth, deferred, Identity, special ),
    												resolve( maxDepth, deferred, Thrower, special )
    											);

    										// Normal processors (resolve) also hook into progress
    										} else {

    											// ...and disregard older resolution values
    											maxDepth++;

    											then.call(
    												returned,
    												resolve( maxDepth, deferred, Identity, special ),
    												resolve( maxDepth, deferred, Thrower, special ),
    												resolve( maxDepth, deferred, Identity,
    													deferred.notifyWith )
    											);
    										}

    									// Handle all other returned values
    									} else {

    										// Only substitute handlers pass on context
    										// and multiple values (non-spec behavior)
    										if ( handler !== Identity ) {
    											that = undefined;
    											args = [ returned ];
    										}

    										// Process the value(s)
    										// Default process is resolve
    										( special || deferred.resolveWith )( that, args );
    									}
    								},

    								// Only normal processors (resolve) catch and reject exceptions
    								process = special ?
    									mightThrow :
    									function() {
    										try {
    											mightThrow();
    										} catch ( e ) {

    											if ( jQuery.Deferred.exceptionHook ) {
    												jQuery.Deferred.exceptionHook( e,
    													process.stackTrace );
    											}

    											// Support: Promises/A+ section 2.3.3.3.4.1
    											// https://promisesaplus.com/#point-61
    											// Ignore post-resolution exceptions
    											if ( depth + 1 >= maxDepth ) {

    												// Only substitute handlers pass on context
    												// and multiple values (non-spec behavior)
    												if ( handler !== Thrower ) {
    													that = undefined;
    													args = [ e ];
    												}

    												deferred.rejectWith( that, args );
    											}
    										}
    									};

    							// Support: Promises/A+ section 2.3.3.3.1
    							// https://promisesaplus.com/#point-57
    							// Re-resolve promises immediately to dodge false rejection from
    							// subsequent errors
    							if ( depth ) {
    								process();
    							} else {

    								// Call an optional hook to record the stack, in case of exception
    								// since it's otherwise lost when execution goes async
    								if ( jQuery.Deferred.getStackHook ) {
    									process.stackTrace = jQuery.Deferred.getStackHook();
    								}
    								window.setTimeout( process );
    							}
    						};
    					}

    					return jQuery.Deferred( function( newDefer ) {

    						// progress_handlers.add( ... )
    						tuples[ 0 ][ 3 ].add(
    							resolve(
    								0,
    								newDefer,
    								isFunction( onProgress ) ?
    									onProgress :
    									Identity,
    								newDefer.notifyWith
    							)
    						);

    						// fulfilled_handlers.add( ... )
    						tuples[ 1 ][ 3 ].add(
    							resolve(
    								0,
    								newDefer,
    								isFunction( onFulfilled ) ?
    									onFulfilled :
    									Identity
    							)
    						);

    						// rejected_handlers.add( ... )
    						tuples[ 2 ][ 3 ].add(
    							resolve(
    								0,
    								newDefer,
    								isFunction( onRejected ) ?
    									onRejected :
    									Thrower
    							)
    						);
    					} ).promise();
    				},

    				// Get a promise for this deferred
    				// If obj is provided, the promise aspect is added to the object
    				promise: function( obj ) {
    					return obj != null ? jQuery.extend( obj, promise ) : promise;
    				}
    			},
    			deferred = {};

    		// Add list-specific methods
    		jQuery.each( tuples, function( i, tuple ) {
    			var list = tuple[ 2 ],
    				stateString = tuple[ 5 ];

    			// promise.progress = list.add
    			// promise.done = list.add
    			// promise.fail = list.add
    			promise[ tuple[ 1 ] ] = list.add;

    			// Handle state
    			if ( stateString ) {
    				list.add(
    					function() {

    						// state = "resolved" (i.e., fulfilled)
    						// state = "rejected"
    						state = stateString;
    					},

    					// rejected_callbacks.disable
    					// fulfilled_callbacks.disable
    					tuples[ 3 - i ][ 2 ].disable,

    					// rejected_handlers.disable
    					// fulfilled_handlers.disable
    					tuples[ 3 - i ][ 3 ].disable,

    					// progress_callbacks.lock
    					tuples[ 0 ][ 2 ].lock,

    					// progress_handlers.lock
    					tuples[ 0 ][ 3 ].lock
    				);
    			}

    			// progress_handlers.fire
    			// fulfilled_handlers.fire
    			// rejected_handlers.fire
    			list.add( tuple[ 3 ].fire );

    			// deferred.notify = function() { deferred.notifyWith(...) }
    			// deferred.resolve = function() { deferred.resolveWith(...) }
    			// deferred.reject = function() { deferred.rejectWith(...) }
    			deferred[ tuple[ 0 ] ] = function() {
    				deferred[ tuple[ 0 ] + "With" ]( this === deferred ? undefined : this, arguments );
    				return this;
    			};

    			// deferred.notifyWith = list.fireWith
    			// deferred.resolveWith = list.fireWith
    			// deferred.rejectWith = list.fireWith
    			deferred[ tuple[ 0 ] + "With" ] = list.fireWith;
    		} );

    		// Make the deferred a promise
    		promise.promise( deferred );

    		// Call given func if any
    		if ( func ) {
    			func.call( deferred, deferred );
    		}

    		// All done!
    		return deferred;
    	},

    	// Deferred helper
    	when: function( singleValue ) {
    		var

    			// count of uncompleted subordinates
    			remaining = arguments.length,

    			// count of unprocessed arguments
    			i = remaining,

    			// subordinate fulfillment data
    			resolveContexts = Array( i ),
    			resolveValues = slice.call( arguments ),

    			// the primary Deferred
    			primary = jQuery.Deferred(),

    			// subordinate callback factory
    			updateFunc = function( i ) {
    				return function( value ) {
    					resolveContexts[ i ] = this;
    					resolveValues[ i ] = arguments.length > 1 ? slice.call( arguments ) : value;
    					if ( !( --remaining ) ) {
    						primary.resolveWith( resolveContexts, resolveValues );
    					}
    				};
    			};

    		// Single- and empty arguments are adopted like Promise.resolve
    		if ( remaining <= 1 ) {
    			adoptValue( singleValue, primary.done( updateFunc( i ) ).resolve, primary.reject,
    				!remaining );

    			// Use .then() to unwrap secondary thenables (cf. gh-3000)
    			if ( primary.state() === "pending" ||
    				isFunction( resolveValues[ i ] && resolveValues[ i ].then ) ) {

    				return primary.then();
    			}
    		}

    		// Multiple arguments are aggregated like Promise.all array elements
    		while ( i-- ) {
    			adoptValue( resolveValues[ i ], updateFunc( i ), primary.reject );
    		}

    		return primary.promise();
    	}
    } );


    // These usually indicate a programmer mistake during development,
    // warn about them ASAP rather than swallowing them by default.
    var rerrorNames = /^(Eval|Internal|Range|Reference|Syntax|Type|URI)Error$/;

    jQuery.Deferred.exceptionHook = function( error, stack ) {

    	// Support: IE 8 - 9 only
    	// Console exists when dev tools are open, which can happen at any time
    	if ( window.console && window.console.warn && error && rerrorNames.test( error.name ) ) {
    		window.console.warn( "jQuery.Deferred exception: " + error.message, error.stack, stack );
    	}
    };




    jQuery.readyException = function( error ) {
    	window.setTimeout( function() {
    		throw error;
    	} );
    };




    // The deferred used on DOM ready
    var readyList = jQuery.Deferred();

    jQuery.fn.ready = function( fn ) {

    	readyList
    		.then( fn )

    		// Wrap jQuery.readyException in a function so that the lookup
    		// happens at the time of error handling instead of callback
    		// registration.
    		.catch( function( error ) {
    			jQuery.readyException( error );
    		} );

    	return this;
    };

    jQuery.extend( {

    	// Is the DOM ready to be used? Set to true once it occurs.
    	isReady: false,

    	// A counter to track how many items to wait for before
    	// the ready event fires. See #6781
    	readyWait: 1,

    	// Handle when the DOM is ready
    	ready: function( wait ) {

    		// Abort if there are pending holds or we're already ready
    		if ( wait === true ? --jQuery.readyWait : jQuery.isReady ) {
    			return;
    		}

    		// Remember that the DOM is ready
    		jQuery.isReady = true;

    		// If a normal DOM Ready event fired, decrement, and wait if need be
    		if ( wait !== true && --jQuery.readyWait > 0 ) {
    			return;
    		}

    		// If there are functions bound, to execute
    		readyList.resolveWith( document, [ jQuery ] );
    	}
    } );

    jQuery.ready.then = readyList.then;

    // The ready event handler and self cleanup method
    function completed() {
    	document.removeEventListener( "DOMContentLoaded", completed );
    	window.removeEventListener( "load", completed );
    	jQuery.ready();
    }

    // Catch cases where $(document).ready() is called
    // after the browser event has already occurred.
    // Support: IE <=9 - 10 only
    // Older IE sometimes signals "interactive" too soon
    if ( document.readyState === "complete" ||
    	( document.readyState !== "loading" && !document.documentElement.doScroll ) ) {

    	// Handle it asynchronously to allow scripts the opportunity to delay ready
    	window.setTimeout( jQuery.ready );

    } else {

    	// Use the handy event callback
    	document.addEventListener( "DOMContentLoaded", completed );

    	// A fallback to window.onload, that will always work
    	window.addEventListener( "load", completed );
    }




    // Multifunctional method to get and set values of a collection
    // The value/s can optionally be executed if it's a function
    var access = function( elems, fn, key, value, chainable, emptyGet, raw ) {
    	var i = 0,
    		len = elems.length,
    		bulk = key == null;

    	// Sets many values
    	if ( toType( key ) === "object" ) {
    		chainable = true;
    		for ( i in key ) {
    			access( elems, fn, i, key[ i ], true, emptyGet, raw );
    		}

    	// Sets one value
    	} else if ( value !== undefined ) {
    		chainable = true;

    		if ( !isFunction( value ) ) {
    			raw = true;
    		}

    		if ( bulk ) {

    			// Bulk operations run against the entire set
    			if ( raw ) {
    				fn.call( elems, value );
    				fn = null;

    			// ...except when executing function values
    			} else {
    				bulk = fn;
    				fn = function( elem, _key, value ) {
    					return bulk.call( jQuery( elem ), value );
    				};
    			}
    		}

    		if ( fn ) {
    			for ( ; i < len; i++ ) {
    				fn(
    					elems[ i ], key, raw ?
    						value :
    						value.call( elems[ i ], i, fn( elems[ i ], key ) )
    				);
    			}
    		}
    	}

    	if ( chainable ) {
    		return elems;
    	}

    	// Gets
    	if ( bulk ) {
    		return fn.call( elems );
    	}

    	return len ? fn( elems[ 0 ], key ) : emptyGet;
    };


    // Matches dashed string for camelizing
    var rmsPrefix = /^-ms-/,
    	rdashAlpha = /-([a-z])/g;

    // Used by camelCase as callback to replace()
    function fcamelCase( _all, letter ) {
    	return letter.toUpperCase();
    }

    // Convert dashed to camelCase; used by the css and data modules
    // Support: IE <=9 - 11, Edge 12 - 15
    // Microsoft forgot to hump their vendor prefix (#9572)
    function camelCase( string ) {
    	return string.replace( rmsPrefix, "ms-" ).replace( rdashAlpha, fcamelCase );
    }
    var acceptData = function( owner ) {

    	// Accepts only:
    	//  - Node
    	//    - Node.ELEMENT_NODE
    	//    - Node.DOCUMENT_NODE
    	//  - Object
    	//    - Any
    	return owner.nodeType === 1 || owner.nodeType === 9 || !( +owner.nodeType );
    };




    function Data() {
    	this.expando = jQuery.expando + Data.uid++;
    }

    Data.uid = 1;

    Data.prototype = {

    	cache: function( owner ) {

    		// Check if the owner object already has a cache
    		var value = owner[ this.expando ];

    		// If not, create one
    		if ( !value ) {
    			value = {};

    			// We can accept data for non-element nodes in modern browsers,
    			// but we should not, see #8335.
    			// Always return an empty object.
    			if ( acceptData( owner ) ) {

    				// If it is a node unlikely to be stringify-ed or looped over
    				// use plain assignment
    				if ( owner.nodeType ) {
    					owner[ this.expando ] = value;

    				// Otherwise secure it in a non-enumerable property
    				// configurable must be true to allow the property to be
    				// deleted when data is removed
    				} else {
    					Object.defineProperty( owner, this.expando, {
    						value: value,
    						configurable: true
    					} );
    				}
    			}
    		}

    		return value;
    	},
    	set: function( owner, data, value ) {
    		var prop,
    			cache = this.cache( owner );

    		// Handle: [ owner, key, value ] args
    		// Always use camelCase key (gh-2257)
    		if ( typeof data === "string" ) {
    			cache[ camelCase( data ) ] = value;

    		// Handle: [ owner, { properties } ] args
    		} else {

    			// Copy the properties one-by-one to the cache object
    			for ( prop in data ) {
    				cache[ camelCase( prop ) ] = data[ prop ];
    			}
    		}
    		return cache;
    	},
    	get: function( owner, key ) {
    		return key === undefined ?
    			this.cache( owner ) :

    			// Always use camelCase key (gh-2257)
    			owner[ this.expando ] && owner[ this.expando ][ camelCase( key ) ];
    	},
    	access: function( owner, key, value ) {

    		// In cases where either:
    		//
    		//   1. No key was specified
    		//   2. A string key was specified, but no value provided
    		//
    		// Take the "read" path and allow the get method to determine
    		// which value to return, respectively either:
    		//
    		//   1. The entire cache object
    		//   2. The data stored at the key
    		//
    		if ( key === undefined ||
    				( ( key && typeof key === "string" ) && value === undefined ) ) {

    			return this.get( owner, key );
    		}

    		// When the key is not a string, or both a key and value
    		// are specified, set or extend (existing objects) with either:
    		//
    		//   1. An object of properties
    		//   2. A key and value
    		//
    		this.set( owner, key, value );

    		// Since the "set" path can have two possible entry points
    		// return the expected data based on which path was taken[*]
    		return value !== undefined ? value : key;
    	},
    	remove: function( owner, key ) {
    		var i,
    			cache = owner[ this.expando ];

    		if ( cache === undefined ) {
    			return;
    		}

    		if ( key !== undefined ) {

    			// Support array or space separated string of keys
    			if ( Array.isArray( key ) ) {

    				// If key is an array of keys...
    				// We always set camelCase keys, so remove that.
    				key = key.map( camelCase );
    			} else {
    				key = camelCase( key );

    				// If a key with the spaces exists, use it.
    				// Otherwise, create an array by matching non-whitespace
    				key = key in cache ?
    					[ key ] :
    					( key.match( rnothtmlwhite ) || [] );
    			}

    			i = key.length;

    			while ( i-- ) {
    				delete cache[ key[ i ] ];
    			}
    		}

    		// Remove the expando if there's no more data
    		if ( key === undefined || jQuery.isEmptyObject( cache ) ) {

    			// Support: Chrome <=35 - 45
    			// Webkit & Blink performance suffers when deleting properties
    			// from DOM nodes, so set to undefined instead
    			// https://bugs.chromium.org/p/chromium/issues/detail?id=378607 (bug restricted)
    			if ( owner.nodeType ) {
    				owner[ this.expando ] = undefined;
    			} else {
    				delete owner[ this.expando ];
    			}
    		}
    	},
    	hasData: function( owner ) {
    		var cache = owner[ this.expando ];
    		return cache !== undefined && !jQuery.isEmptyObject( cache );
    	}
    };
    var dataPriv = new Data();

    var dataUser = new Data();



    //	Implementation Summary
    //
    //	1. Enforce API surface and semantic compatibility with 1.9.x branch
    //	2. Improve the module's maintainability by reducing the storage
    //		paths to a single mechanism.
    //	3. Use the same single mechanism to support "private" and "user" data.
    //	4. _Never_ expose "private" data to user code (TODO: Drop _data, _removeData)
    //	5. Avoid exposing implementation details on user objects (eg. expando properties)
    //	6. Provide a clear path for implementation upgrade to WeakMap in 2014

    var rbrace = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,
    	rmultiDash = /[A-Z]/g;

    function getData( data ) {
    	if ( data === "true" ) {
    		return true;
    	}

    	if ( data === "false" ) {
    		return false;
    	}

    	if ( data === "null" ) {
    		return null;
    	}

    	// Only convert to a number if it doesn't change the string
    	if ( data === +data + "" ) {
    		return +data;
    	}

    	if ( rbrace.test( data ) ) {
    		return JSON.parse( data );
    	}

    	return data;
    }

    function dataAttr( elem, key, data ) {
    	var name;

    	// If nothing was found internally, try to fetch any
    	// data from the HTML5 data-* attribute
    	if ( data === undefined && elem.nodeType === 1 ) {
    		name = "data-" + key.replace( rmultiDash, "-$&" ).toLowerCase();
    		data = elem.getAttribute( name );

    		if ( typeof data === "string" ) {
    			try {
    				data = getData( data );
    			} catch ( e ) {}

    			// Make sure we set the data so it isn't changed later
    			dataUser.set( elem, key, data );
    		} else {
    			data = undefined;
    		}
    	}
    	return data;
    }

    jQuery.extend( {
    	hasData: function( elem ) {
    		return dataUser.hasData( elem ) || dataPriv.hasData( elem );
    	},

    	data: function( elem, name, data ) {
    		return dataUser.access( elem, name, data );
    	},

    	removeData: function( elem, name ) {
    		dataUser.remove( elem, name );
    	},

    	// TODO: Now that all calls to _data and _removeData have been replaced
    	// with direct calls to dataPriv methods, these can be deprecated.
    	_data: function( elem, name, data ) {
    		return dataPriv.access( elem, name, data );
    	},

    	_removeData: function( elem, name ) {
    		dataPriv.remove( elem, name );
    	}
    } );

    jQuery.fn.extend( {
    	data: function( key, value ) {
    		var i, name, data,
    			elem = this[ 0 ],
    			attrs = elem && elem.attributes;

    		// Gets all values
    		if ( key === undefined ) {
    			if ( this.length ) {
    				data = dataUser.get( elem );

    				if ( elem.nodeType === 1 && !dataPriv.get( elem, "hasDataAttrs" ) ) {
    					i = attrs.length;
    					while ( i-- ) {

    						// Support: IE 11 only
    						// The attrs elements can be null (#14894)
    						if ( attrs[ i ] ) {
    							name = attrs[ i ].name;
    							if ( name.indexOf( "data-" ) === 0 ) {
    								name = camelCase( name.slice( 5 ) );
    								dataAttr( elem, name, data[ name ] );
    							}
    						}
    					}
    					dataPriv.set( elem, "hasDataAttrs", true );
    				}
    			}

    			return data;
    		}

    		// Sets multiple values
    		if ( typeof key === "object" ) {
    			return this.each( function() {
    				dataUser.set( this, key );
    			} );
    		}

    		return access( this, function( value ) {
    			var data;

    			// The calling jQuery object (element matches) is not empty
    			// (and therefore has an element appears at this[ 0 ]) and the
    			// `value` parameter was not undefined. An empty jQuery object
    			// will result in `undefined` for elem = this[ 0 ] which will
    			// throw an exception if an attempt to read a data cache is made.
    			if ( elem && value === undefined ) {

    				// Attempt to get data from the cache
    				// The key will always be camelCased in Data
    				data = dataUser.get( elem, key );
    				if ( data !== undefined ) {
    					return data;
    				}

    				// Attempt to "discover" the data in
    				// HTML5 custom data-* attrs
    				data = dataAttr( elem, key );
    				if ( data !== undefined ) {
    					return data;
    				}

    				// We tried really hard, but the data doesn't exist.
    				return;
    			}

    			// Set the data...
    			this.each( function() {

    				// We always store the camelCased key
    				dataUser.set( this, key, value );
    			} );
    		}, null, value, arguments.length > 1, null, true );
    	},

    	removeData: function( key ) {
    		return this.each( function() {
    			dataUser.remove( this, key );
    		} );
    	}
    } );


    jQuery.extend( {
    	queue: function( elem, type, data ) {
    		var queue;

    		if ( elem ) {
    			type = ( type || "fx" ) + "queue";
    			queue = dataPriv.get( elem, type );

    			// Speed up dequeue by getting out quickly if this is just a lookup
    			if ( data ) {
    				if ( !queue || Array.isArray( data ) ) {
    					queue = dataPriv.access( elem, type, jQuery.makeArray( data ) );
    				} else {
    					queue.push( data );
    				}
    			}
    			return queue || [];
    		}
    	},

    	dequeue: function( elem, type ) {
    		type = type || "fx";

    		var queue = jQuery.queue( elem, type ),
    			startLength = queue.length,
    			fn = queue.shift(),
    			hooks = jQuery._queueHooks( elem, type ),
    			next = function() {
    				jQuery.dequeue( elem, type );
    			};

    		// If the fx queue is dequeued, always remove the progress sentinel
    		if ( fn === "inprogress" ) {
    			fn = queue.shift();
    			startLength--;
    		}

    		if ( fn ) {

    			// Add a progress sentinel to prevent the fx queue from being
    			// automatically dequeued
    			if ( type === "fx" ) {
    				queue.unshift( "inprogress" );
    			}

    			// Clear up the last queue stop function
    			delete hooks.stop;
    			fn.call( elem, next, hooks );
    		}

    		if ( !startLength && hooks ) {
    			hooks.empty.fire();
    		}
    	},

    	// Not public - generate a queueHooks object, or return the current one
    	_queueHooks: function( elem, type ) {
    		var key = type + "queueHooks";
    		return dataPriv.get( elem, key ) || dataPriv.access( elem, key, {
    			empty: jQuery.Callbacks( "once memory" ).add( function() {
    				dataPriv.remove( elem, [ type + "queue", key ] );
    			} )
    		} );
    	}
    } );

    jQuery.fn.extend( {
    	queue: function( type, data ) {
    		var setter = 2;

    		if ( typeof type !== "string" ) {
    			data = type;
    			type = "fx";
    			setter--;
    		}

    		if ( arguments.length < setter ) {
    			return jQuery.queue( this[ 0 ], type );
    		}

    		return data === undefined ?
    			this :
    			this.each( function() {
    				var queue = jQuery.queue( this, type, data );

    				// Ensure a hooks for this queue
    				jQuery._queueHooks( this, type );

    				if ( type === "fx" && queue[ 0 ] !== "inprogress" ) {
    					jQuery.dequeue( this, type );
    				}
    			} );
    	},
    	dequeue: function( type ) {
    		return this.each( function() {
    			jQuery.dequeue( this, type );
    		} );
    	},
    	clearQueue: function( type ) {
    		return this.queue( type || "fx", [] );
    	},

    	// Get a promise resolved when queues of a certain type
    	// are emptied (fx is the type by default)
    	promise: function( type, obj ) {
    		var tmp,
    			count = 1,
    			defer = jQuery.Deferred(),
    			elements = this,
    			i = this.length,
    			resolve = function() {
    				if ( !( --count ) ) {
    					defer.resolveWith( elements, [ elements ] );
    				}
    			};

    		if ( typeof type !== "string" ) {
    			obj = type;
    			type = undefined;
    		}
    		type = type || "fx";

    		while ( i-- ) {
    			tmp = dataPriv.get( elements[ i ], type + "queueHooks" );
    			if ( tmp && tmp.empty ) {
    				count++;
    				tmp.empty.add( resolve );
    			}
    		}
    		resolve();
    		return defer.promise( obj );
    	}
    } );
    var pnum = ( /[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/ ).source;

    var rcssNum = new RegExp( "^(?:([+-])=|)(" + pnum + ")([a-z%]*)$", "i" );


    var cssExpand = [ "Top", "Right", "Bottom", "Left" ];

    var documentElement = document.documentElement;



    	var isAttached = function( elem ) {
    			return jQuery.contains( elem.ownerDocument, elem );
    		},
    		composed = { composed: true };

    	// Support: IE 9 - 11+, Edge 12 - 18+, iOS 10.0 - 10.2 only
    	// Check attachment across shadow DOM boundaries when possible (gh-3504)
    	// Support: iOS 10.0-10.2 only
    	// Early iOS 10 versions support `attachShadow` but not `getRootNode`,
    	// leading to errors. We need to check for `getRootNode`.
    	if ( documentElement.getRootNode ) {
    		isAttached = function( elem ) {
    			return jQuery.contains( elem.ownerDocument, elem ) ||
    				elem.getRootNode( composed ) === elem.ownerDocument;
    		};
    	}
    var isHiddenWithinTree = function( elem, el ) {

    		// isHiddenWithinTree might be called from jQuery#filter function;
    		// in that case, element will be second argument
    		elem = el || elem;

    		// Inline style trumps all
    		return elem.style.display === "none" ||
    			elem.style.display === "" &&

    			// Otherwise, check computed style
    			// Support: Firefox <=43 - 45
    			// Disconnected elements can have computed display: none, so first confirm that elem is
    			// in the document.
    			isAttached( elem ) &&

    			jQuery.css( elem, "display" ) === "none";
    	};



    function adjustCSS( elem, prop, valueParts, tween ) {
    	var adjusted, scale,
    		maxIterations = 20,
    		currentValue = tween ?
    			function() {
    				return tween.cur();
    			} :
    			function() {
    				return jQuery.css( elem, prop, "" );
    			},
    		initial = currentValue(),
    		unit = valueParts && valueParts[ 3 ] || ( jQuery.cssNumber[ prop ] ? "" : "px" ),

    		// Starting value computation is required for potential unit mismatches
    		initialInUnit = elem.nodeType &&
    			( jQuery.cssNumber[ prop ] || unit !== "px" && +initial ) &&
    			rcssNum.exec( jQuery.css( elem, prop ) );

    	if ( initialInUnit && initialInUnit[ 3 ] !== unit ) {

    		// Support: Firefox <=54
    		// Halve the iteration target value to prevent interference from CSS upper bounds (gh-2144)
    		initial = initial / 2;

    		// Trust units reported by jQuery.css
    		unit = unit || initialInUnit[ 3 ];

    		// Iteratively approximate from a nonzero starting point
    		initialInUnit = +initial || 1;

    		while ( maxIterations-- ) {

    			// Evaluate and update our best guess (doubling guesses that zero out).
    			// Finish if the scale equals or crosses 1 (making the old*new product non-positive).
    			jQuery.style( elem, prop, initialInUnit + unit );
    			if ( ( 1 - scale ) * ( 1 - ( scale = currentValue() / initial || 0.5 ) ) <= 0 ) {
    				maxIterations = 0;
    			}
    			initialInUnit = initialInUnit / scale;

    		}

    		initialInUnit = initialInUnit * 2;
    		jQuery.style( elem, prop, initialInUnit + unit );

    		// Make sure we update the tween properties later on
    		valueParts = valueParts || [];
    	}

    	if ( valueParts ) {
    		initialInUnit = +initialInUnit || +initial || 0;

    		// Apply relative offset (+=/-=) if specified
    		adjusted = valueParts[ 1 ] ?
    			initialInUnit + ( valueParts[ 1 ] + 1 ) * valueParts[ 2 ] :
    			+valueParts[ 2 ];
    		if ( tween ) {
    			tween.unit = unit;
    			tween.start = initialInUnit;
    			tween.end = adjusted;
    		}
    	}
    	return adjusted;
    }


    var defaultDisplayMap = {};

    function getDefaultDisplay( elem ) {
    	var temp,
    		doc = elem.ownerDocument,
    		nodeName = elem.nodeName,
    		display = defaultDisplayMap[ nodeName ];

    	if ( display ) {
    		return display;
    	}

    	temp = doc.body.appendChild( doc.createElement( nodeName ) );
    	display = jQuery.css( temp, "display" );

    	temp.parentNode.removeChild( temp );

    	if ( display === "none" ) {
    		display = "block";
    	}
    	defaultDisplayMap[ nodeName ] = display;

    	return display;
    }

    function showHide( elements, show ) {
    	var display, elem,
    		values = [],
    		index = 0,
    		length = elements.length;

    	// Determine new display value for elements that need to change
    	for ( ; index < length; index++ ) {
    		elem = elements[ index ];
    		if ( !elem.style ) {
    			continue;
    		}

    		display = elem.style.display;
    		if ( show ) {

    			// Since we force visibility upon cascade-hidden elements, an immediate (and slow)
    			// check is required in this first loop unless we have a nonempty display value (either
    			// inline or about-to-be-restored)
    			if ( display === "none" ) {
    				values[ index ] = dataPriv.get( elem, "display" ) || null;
    				if ( !values[ index ] ) {
    					elem.style.display = "";
    				}
    			}
    			if ( elem.style.display === "" && isHiddenWithinTree( elem ) ) {
    				values[ index ] = getDefaultDisplay( elem );
    			}
    		} else {
    			if ( display !== "none" ) {
    				values[ index ] = "none";

    				// Remember what we're overwriting
    				dataPriv.set( elem, "display", display );
    			}
    		}
    	}

    	// Set the display of the elements in a second loop to avoid constant reflow
    	for ( index = 0; index < length; index++ ) {
    		if ( values[ index ] != null ) {
    			elements[ index ].style.display = values[ index ];
    		}
    	}

    	return elements;
    }

    jQuery.fn.extend( {
    	show: function() {
    		return showHide( this, true );
    	},
    	hide: function() {
    		return showHide( this );
    	},
    	toggle: function( state ) {
    		if ( typeof state === "boolean" ) {
    			return state ? this.show() : this.hide();
    		}

    		return this.each( function() {
    			if ( isHiddenWithinTree( this ) ) {
    				jQuery( this ).show();
    			} else {
    				jQuery( this ).hide();
    			}
    		} );
    	}
    } );
    var rcheckableType = ( /^(?:checkbox|radio)$/i );

    var rtagName = ( /<([a-z][^\/\0>\x20\t\r\n\f]*)/i );

    var rscriptType = ( /^$|^module$|\/(?:java|ecma)script/i );



    ( function() {
    	var fragment = document.createDocumentFragment(),
    		div = fragment.appendChild( document.createElement( "div" ) ),
    		input = document.createElement( "input" );

    	// Support: Android 4.0 - 4.3 only
    	// Check state lost if the name is set (#11217)
    	// Support: Windows Web Apps (WWA)
    	// `name` and `type` must use .setAttribute for WWA (#14901)
    	input.setAttribute( "type", "radio" );
    	input.setAttribute( "checked", "checked" );
    	input.setAttribute( "name", "t" );

    	div.appendChild( input );

    	// Support: Android <=4.1 only
    	// Older WebKit doesn't clone checked state correctly in fragments
    	support.checkClone = div.cloneNode( true ).cloneNode( true ).lastChild.checked;

    	// Support: IE <=11 only
    	// Make sure textarea (and checkbox) defaultValue is properly cloned
    	div.innerHTML = "<textarea>x</textarea>";
    	support.noCloneChecked = !!div.cloneNode( true ).lastChild.defaultValue;

    	// Support: IE <=9 only
    	// IE <=9 replaces <option> tags with their contents when inserted outside of
    	// the select element.
    	div.innerHTML = "<option></option>";
    	support.option = !!div.lastChild;
    } )();


    // We have to close these tags to support XHTML (#13200)
    var wrapMap = {

    	// XHTML parsers do not magically insert elements in the
    	// same way that tag soup parsers do. So we cannot shorten
    	// this by omitting <tbody> or other required elements.
    	thead: [ 1, "<table>", "</table>" ],
    	col: [ 2, "<table><colgroup>", "</colgroup></table>" ],
    	tr: [ 2, "<table><tbody>", "</tbody></table>" ],
    	td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],

    	_default: [ 0, "", "" ]
    };

    wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
    wrapMap.th = wrapMap.td;

    // Support: IE <=9 only
    if ( !support.option ) {
    	wrapMap.optgroup = wrapMap.option = [ 1, "<select multiple='multiple'>", "</select>" ];
    }


    function getAll( context, tag ) {

    	// Support: IE <=9 - 11 only
    	// Use typeof to avoid zero-argument method invocation on host objects (#15151)
    	var ret;

    	if ( typeof context.getElementsByTagName !== "undefined" ) {
    		ret = context.getElementsByTagName( tag || "*" );

    	} else if ( typeof context.querySelectorAll !== "undefined" ) {
    		ret = context.querySelectorAll( tag || "*" );

    	} else {
    		ret = [];
    	}

    	if ( tag === undefined || tag && nodeName( context, tag ) ) {
    		return jQuery.merge( [ context ], ret );
    	}

    	return ret;
    }


    // Mark scripts as having already been evaluated
    function setGlobalEval( elems, refElements ) {
    	var i = 0,
    		l = elems.length;

    	for ( ; i < l; i++ ) {
    		dataPriv.set(
    			elems[ i ],
    			"globalEval",
    			!refElements || dataPriv.get( refElements[ i ], "globalEval" )
    		);
    	}
    }


    var rhtml = /<|&#?\w+;/;

    function buildFragment( elems, context, scripts, selection, ignored ) {
    	var elem, tmp, tag, wrap, attached, j,
    		fragment = context.createDocumentFragment(),
    		nodes = [],
    		i = 0,
    		l = elems.length;

    	for ( ; i < l; i++ ) {
    		elem = elems[ i ];

    		if ( elem || elem === 0 ) {

    			// Add nodes directly
    			if ( toType( elem ) === "object" ) {

    				// Support: Android <=4.0 only, PhantomJS 1 only
    				// push.apply(_, arraylike) throws on ancient WebKit
    				jQuery.merge( nodes, elem.nodeType ? [ elem ] : elem );

    			// Convert non-html into a text node
    			} else if ( !rhtml.test( elem ) ) {
    				nodes.push( context.createTextNode( elem ) );

    			// Convert html into DOM nodes
    			} else {
    				tmp = tmp || fragment.appendChild( context.createElement( "div" ) );

    				// Deserialize a standard representation
    				tag = ( rtagName.exec( elem ) || [ "", "" ] )[ 1 ].toLowerCase();
    				wrap = wrapMap[ tag ] || wrapMap._default;
    				tmp.innerHTML = wrap[ 1 ] + jQuery.htmlPrefilter( elem ) + wrap[ 2 ];

    				// Descend through wrappers to the right content
    				j = wrap[ 0 ];
    				while ( j-- ) {
    					tmp = tmp.lastChild;
    				}

    				// Support: Android <=4.0 only, PhantomJS 1 only
    				// push.apply(_, arraylike) throws on ancient WebKit
    				jQuery.merge( nodes, tmp.childNodes );

    				// Remember the top-level container
    				tmp = fragment.firstChild;

    				// Ensure the created nodes are orphaned (#12392)
    				tmp.textContent = "";
    			}
    		}
    	}

    	// Remove wrapper from fragment
    	fragment.textContent = "";

    	i = 0;
    	while ( ( elem = nodes[ i++ ] ) ) {

    		// Skip elements already in the context collection (trac-4087)
    		if ( selection && jQuery.inArray( elem, selection ) > -1 ) {
    			if ( ignored ) {
    				ignored.push( elem );
    			}
    			continue;
    		}

    		attached = isAttached( elem );

    		// Append to fragment
    		tmp = getAll( fragment.appendChild( elem ), "script" );

    		// Preserve script evaluation history
    		if ( attached ) {
    			setGlobalEval( tmp );
    		}

    		// Capture executables
    		if ( scripts ) {
    			j = 0;
    			while ( ( elem = tmp[ j++ ] ) ) {
    				if ( rscriptType.test( elem.type || "" ) ) {
    					scripts.push( elem );
    				}
    			}
    		}
    	}

    	return fragment;
    }


    var rtypenamespace = /^([^.]*)(?:\.(.+)|)/;

    function returnTrue() {
    	return true;
    }

    function returnFalse() {
    	return false;
    }

    // Support: IE <=9 - 11+
    // focus() and blur() are asynchronous, except when they are no-op.
    // So expect focus to be synchronous when the element is already active,
    // and blur to be synchronous when the element is not already active.
    // (focus and blur are always synchronous in other supported browsers,
    // this just defines when we can count on it).
    function expectSync( elem, type ) {
    	return ( elem === safeActiveElement() ) === ( type === "focus" );
    }

    // Support: IE <=9 only
    // Accessing document.activeElement can throw unexpectedly
    // https://bugs.jquery.com/ticket/13393
    function safeActiveElement() {
    	try {
    		return document.activeElement;
    	} catch ( err ) { }
    }

    function on( elem, types, selector, data, fn, one ) {
    	var origFn, type;

    	// Types can be a map of types/handlers
    	if ( typeof types === "object" ) {

    		// ( types-Object, selector, data )
    		if ( typeof selector !== "string" ) {

    			// ( types-Object, data )
    			data = data || selector;
    			selector = undefined;
    		}
    		for ( type in types ) {
    			on( elem, type, selector, data, types[ type ], one );
    		}
    		return elem;
    	}

    	if ( data == null && fn == null ) {

    		// ( types, fn )
    		fn = selector;
    		data = selector = undefined;
    	} else if ( fn == null ) {
    		if ( typeof selector === "string" ) {

    			// ( types, selector, fn )
    			fn = data;
    			data = undefined;
    		} else {

    			// ( types, data, fn )
    			fn = data;
    			data = selector;
    			selector = undefined;
    		}
    	}
    	if ( fn === false ) {
    		fn = returnFalse;
    	} else if ( !fn ) {
    		return elem;
    	}

    	if ( one === 1 ) {
    		origFn = fn;
    		fn = function( event ) {

    			// Can use an empty set, since event contains the info
    			jQuery().off( event );
    			return origFn.apply( this, arguments );
    		};

    		// Use same guid so caller can remove using origFn
    		fn.guid = origFn.guid || ( origFn.guid = jQuery.guid++ );
    	}
    	return elem.each( function() {
    		jQuery.event.add( this, types, fn, data, selector );
    	} );
    }

    /*
     * Helper functions for managing events -- not part of the public interface.
     * Props to Dean Edwards' addEvent library for many of the ideas.
     */
    jQuery.event = {

    	global: {},

    	add: function( elem, types, handler, data, selector ) {

    		var handleObjIn, eventHandle, tmp,
    			events, t, handleObj,
    			special, handlers, type, namespaces, origType,
    			elemData = dataPriv.get( elem );

    		// Only attach events to objects that accept data
    		if ( !acceptData( elem ) ) {
    			return;
    		}

    		// Caller can pass in an object of custom data in lieu of the handler
    		if ( handler.handler ) {
    			handleObjIn = handler;
    			handler = handleObjIn.handler;
    			selector = handleObjIn.selector;
    		}

    		// Ensure that invalid selectors throw exceptions at attach time
    		// Evaluate against documentElement in case elem is a non-element node (e.g., document)
    		if ( selector ) {
    			jQuery.find.matchesSelector( documentElement, selector );
    		}

    		// Make sure that the handler has a unique ID, used to find/remove it later
    		if ( !handler.guid ) {
    			handler.guid = jQuery.guid++;
    		}

    		// Init the element's event structure and main handler, if this is the first
    		if ( !( events = elemData.events ) ) {
    			events = elemData.events = Object.create( null );
    		}
    		if ( !( eventHandle = elemData.handle ) ) {
    			eventHandle = elemData.handle = function( e ) {

    				// Discard the second event of a jQuery.event.trigger() and
    				// when an event is called after a page has unloaded
    				return typeof jQuery !== "undefined" && jQuery.event.triggered !== e.type ?
    					jQuery.event.dispatch.apply( elem, arguments ) : undefined;
    			};
    		}

    		// Handle multiple events separated by a space
    		types = ( types || "" ).match( rnothtmlwhite ) || [ "" ];
    		t = types.length;
    		while ( t-- ) {
    			tmp = rtypenamespace.exec( types[ t ] ) || [];
    			type = origType = tmp[ 1 ];
    			namespaces = ( tmp[ 2 ] || "" ).split( "." ).sort();

    			// There *must* be a type, no attaching namespace-only handlers
    			if ( !type ) {
    				continue;
    			}

    			// If event changes its type, use the special event handlers for the changed type
    			special = jQuery.event.special[ type ] || {};

    			// If selector defined, determine special event api type, otherwise given type
    			type = ( selector ? special.delegateType : special.bindType ) || type;

    			// Update special based on newly reset type
    			special = jQuery.event.special[ type ] || {};

    			// handleObj is passed to all event handlers
    			handleObj = jQuery.extend( {
    				type: type,
    				origType: origType,
    				data: data,
    				handler: handler,
    				guid: handler.guid,
    				selector: selector,
    				needsContext: selector && jQuery.expr.match.needsContext.test( selector ),
    				namespace: namespaces.join( "." )
    			}, handleObjIn );

    			// Init the event handler queue if we're the first
    			if ( !( handlers = events[ type ] ) ) {
    				handlers = events[ type ] = [];
    				handlers.delegateCount = 0;

    				// Only use addEventListener if the special events handler returns false
    				if ( !special.setup ||
    					special.setup.call( elem, data, namespaces, eventHandle ) === false ) {

    					if ( elem.addEventListener ) {
    						elem.addEventListener( type, eventHandle );
    					}
    				}
    			}

    			if ( special.add ) {
    				special.add.call( elem, handleObj );

    				if ( !handleObj.handler.guid ) {
    					handleObj.handler.guid = handler.guid;
    				}
    			}

    			// Add to the element's handler list, delegates in front
    			if ( selector ) {
    				handlers.splice( handlers.delegateCount++, 0, handleObj );
    			} else {
    				handlers.push( handleObj );
    			}

    			// Keep track of which events have ever been used, for event optimization
    			jQuery.event.global[ type ] = true;
    		}

    	},

    	// Detach an event or set of events from an element
    	remove: function( elem, types, handler, selector, mappedTypes ) {

    		var j, origCount, tmp,
    			events, t, handleObj,
    			special, handlers, type, namespaces, origType,
    			elemData = dataPriv.hasData( elem ) && dataPriv.get( elem );

    		if ( !elemData || !( events = elemData.events ) ) {
    			return;
    		}

    		// Once for each type.namespace in types; type may be omitted
    		types = ( types || "" ).match( rnothtmlwhite ) || [ "" ];
    		t = types.length;
    		while ( t-- ) {
    			tmp = rtypenamespace.exec( types[ t ] ) || [];
    			type = origType = tmp[ 1 ];
    			namespaces = ( tmp[ 2 ] || "" ).split( "." ).sort();

    			// Unbind all events (on this namespace, if provided) for the element
    			if ( !type ) {
    				for ( type in events ) {
    					jQuery.event.remove( elem, type + types[ t ], handler, selector, true );
    				}
    				continue;
    			}

    			special = jQuery.event.special[ type ] || {};
    			type = ( selector ? special.delegateType : special.bindType ) || type;
    			handlers = events[ type ] || [];
    			tmp = tmp[ 2 ] &&
    				new RegExp( "(^|\\.)" + namespaces.join( "\\.(?:.*\\.|)" ) + "(\\.|$)" );

    			// Remove matching events
    			origCount = j = handlers.length;
    			while ( j-- ) {
    				handleObj = handlers[ j ];

    				if ( ( mappedTypes || origType === handleObj.origType ) &&
    					( !handler || handler.guid === handleObj.guid ) &&
    					( !tmp || tmp.test( handleObj.namespace ) ) &&
    					( !selector || selector === handleObj.selector ||
    						selector === "**" && handleObj.selector ) ) {
    					handlers.splice( j, 1 );

    					if ( handleObj.selector ) {
    						handlers.delegateCount--;
    					}
    					if ( special.remove ) {
    						special.remove.call( elem, handleObj );
    					}
    				}
    			}

    			// Remove generic event handler if we removed something and no more handlers exist
    			// (avoids potential for endless recursion during removal of special event handlers)
    			if ( origCount && !handlers.length ) {
    				if ( !special.teardown ||
    					special.teardown.call( elem, namespaces, elemData.handle ) === false ) {

    					jQuery.removeEvent( elem, type, elemData.handle );
    				}

    				delete events[ type ];
    			}
    		}

    		// Remove data and the expando if it's no longer used
    		if ( jQuery.isEmptyObject( events ) ) {
    			dataPriv.remove( elem, "handle events" );
    		}
    	},

    	dispatch: function( nativeEvent ) {

    		var i, j, ret, matched, handleObj, handlerQueue,
    			args = new Array( arguments.length ),

    			// Make a writable jQuery.Event from the native event object
    			event = jQuery.event.fix( nativeEvent ),

    			handlers = (
    				dataPriv.get( this, "events" ) || Object.create( null )
    			)[ event.type ] || [],
    			special = jQuery.event.special[ event.type ] || {};

    		// Use the fix-ed jQuery.Event rather than the (read-only) native event
    		args[ 0 ] = event;

    		for ( i = 1; i < arguments.length; i++ ) {
    			args[ i ] = arguments[ i ];
    		}

    		event.delegateTarget = this;

    		// Call the preDispatch hook for the mapped type, and let it bail if desired
    		if ( special.preDispatch && special.preDispatch.call( this, event ) === false ) {
    			return;
    		}

    		// Determine handlers
    		handlerQueue = jQuery.event.handlers.call( this, event, handlers );

    		// Run delegates first; they may want to stop propagation beneath us
    		i = 0;
    		while ( ( matched = handlerQueue[ i++ ] ) && !event.isPropagationStopped() ) {
    			event.currentTarget = matched.elem;

    			j = 0;
    			while ( ( handleObj = matched.handlers[ j++ ] ) &&
    				!event.isImmediatePropagationStopped() ) {

    				// If the event is namespaced, then each handler is only invoked if it is
    				// specially universal or its namespaces are a superset of the event's.
    				if ( !event.rnamespace || handleObj.namespace === false ||
    					event.rnamespace.test( handleObj.namespace ) ) {

    					event.handleObj = handleObj;
    					event.data = handleObj.data;

    					ret = ( ( jQuery.event.special[ handleObj.origType ] || {} ).handle ||
    						handleObj.handler ).apply( matched.elem, args );

    					if ( ret !== undefined ) {
    						if ( ( event.result = ret ) === false ) {
    							event.preventDefault();
    							event.stopPropagation();
    						}
    					}
    				}
    			}
    		}

    		// Call the postDispatch hook for the mapped type
    		if ( special.postDispatch ) {
    			special.postDispatch.call( this, event );
    		}

    		return event.result;
    	},

    	handlers: function( event, handlers ) {
    		var i, handleObj, sel, matchedHandlers, matchedSelectors,
    			handlerQueue = [],
    			delegateCount = handlers.delegateCount,
    			cur = event.target;

    		// Find delegate handlers
    		if ( delegateCount &&

    			// Support: IE <=9
    			// Black-hole SVG <use> instance trees (trac-13180)
    			cur.nodeType &&

    			// Support: Firefox <=42
    			// Suppress spec-violating clicks indicating a non-primary pointer button (trac-3861)
    			// https://www.w3.org/TR/DOM-Level-3-Events/#event-type-click
    			// Support: IE 11 only
    			// ...but not arrow key "clicks" of radio inputs, which can have `button` -1 (gh-2343)
    			!( event.type === "click" && event.button >= 1 ) ) {

    			for ( ; cur !== this; cur = cur.parentNode || this ) {

    				// Don't check non-elements (#13208)
    				// Don't process clicks on disabled elements (#6911, #8165, #11382, #11764)
    				if ( cur.nodeType === 1 && !( event.type === "click" && cur.disabled === true ) ) {
    					matchedHandlers = [];
    					matchedSelectors = {};
    					for ( i = 0; i < delegateCount; i++ ) {
    						handleObj = handlers[ i ];

    						// Don't conflict with Object.prototype properties (#13203)
    						sel = handleObj.selector + " ";

    						if ( matchedSelectors[ sel ] === undefined ) {
    							matchedSelectors[ sel ] = handleObj.needsContext ?
    								jQuery( sel, this ).index( cur ) > -1 :
    								jQuery.find( sel, this, null, [ cur ] ).length;
    						}
    						if ( matchedSelectors[ sel ] ) {
    							matchedHandlers.push( handleObj );
    						}
    					}
    					if ( matchedHandlers.length ) {
    						handlerQueue.push( { elem: cur, handlers: matchedHandlers } );
    					}
    				}
    			}
    		}

    		// Add the remaining (directly-bound) handlers
    		cur = this;
    		if ( delegateCount < handlers.length ) {
    			handlerQueue.push( { elem: cur, handlers: handlers.slice( delegateCount ) } );
    		}

    		return handlerQueue;
    	},

    	addProp: function( name, hook ) {
    		Object.defineProperty( jQuery.Event.prototype, name, {
    			enumerable: true,
    			configurable: true,

    			get: isFunction( hook ) ?
    				function() {
    					if ( this.originalEvent ) {
    						return hook( this.originalEvent );
    					}
    				} :
    				function() {
    					if ( this.originalEvent ) {
    						return this.originalEvent[ name ];
    					}
    				},

    			set: function( value ) {
    				Object.defineProperty( this, name, {
    					enumerable: true,
    					configurable: true,
    					writable: true,
    					value: value
    				} );
    			}
    		} );
    	},

    	fix: function( originalEvent ) {
    		return originalEvent[ jQuery.expando ] ?
    			originalEvent :
    			new jQuery.Event( originalEvent );
    	},

    	special: {
    		load: {

    			// Prevent triggered image.load events from bubbling to window.load
    			noBubble: true
    		},
    		click: {

    			// Utilize native event to ensure correct state for checkable inputs
    			setup: function( data ) {

    				// For mutual compressibility with _default, replace `this` access with a local var.
    				// `|| data` is dead code meant only to preserve the variable through minification.
    				var el = this || data;

    				// Claim the first handler
    				if ( rcheckableType.test( el.type ) &&
    					el.click && nodeName( el, "input" ) ) {

    					// dataPriv.set( el, "click", ... )
    					leverageNative( el, "click", returnTrue );
    				}

    				// Return false to allow normal processing in the caller
    				return false;
    			},
    			trigger: function( data ) {

    				// For mutual compressibility with _default, replace `this` access with a local var.
    				// `|| data` is dead code meant only to preserve the variable through minification.
    				var el = this || data;

    				// Force setup before triggering a click
    				if ( rcheckableType.test( el.type ) &&
    					el.click && nodeName( el, "input" ) ) {

    					leverageNative( el, "click" );
    				}

    				// Return non-false to allow normal event-path propagation
    				return true;
    			},

    			// For cross-browser consistency, suppress native .click() on links
    			// Also prevent it if we're currently inside a leveraged native-event stack
    			_default: function( event ) {
    				var target = event.target;
    				return rcheckableType.test( target.type ) &&
    					target.click && nodeName( target, "input" ) &&
    					dataPriv.get( target, "click" ) ||
    					nodeName( target, "a" );
    			}
    		},

    		beforeunload: {
    			postDispatch: function( event ) {

    				// Support: Firefox 20+
    				// Firefox doesn't alert if the returnValue field is not set.
    				if ( event.result !== undefined && event.originalEvent ) {
    					event.originalEvent.returnValue = event.result;
    				}
    			}
    		}
    	}
    };

    // Ensure the presence of an event listener that handles manually-triggered
    // synthetic events by interrupting progress until reinvoked in response to
    // *native* events that it fires directly, ensuring that state changes have
    // already occurred before other listeners are invoked.
    function leverageNative( el, type, expectSync ) {

    	// Missing expectSync indicates a trigger call, which must force setup through jQuery.event.add
    	if ( !expectSync ) {
    		if ( dataPriv.get( el, type ) === undefined ) {
    			jQuery.event.add( el, type, returnTrue );
    		}
    		return;
    	}

    	// Register the controller as a special universal handler for all event namespaces
    	dataPriv.set( el, type, false );
    	jQuery.event.add( el, type, {
    		namespace: false,
    		handler: function( event ) {
    			var notAsync, result,
    				saved = dataPriv.get( this, type );

    			if ( ( event.isTrigger & 1 ) && this[ type ] ) {

    				// Interrupt processing of the outer synthetic .trigger()ed event
    				// Saved data should be false in such cases, but might be a leftover capture object
    				// from an async native handler (gh-4350)
    				if ( !saved.length ) {

    					// Store arguments for use when handling the inner native event
    					// There will always be at least one argument (an event object), so this array
    					// will not be confused with a leftover capture object.
    					saved = slice.call( arguments );
    					dataPriv.set( this, type, saved );

    					// Trigger the native event and capture its result
    					// Support: IE <=9 - 11+
    					// focus() and blur() are asynchronous
    					notAsync = expectSync( this, type );
    					this[ type ]();
    					result = dataPriv.get( this, type );
    					if ( saved !== result || notAsync ) {
    						dataPriv.set( this, type, false );
    					} else {
    						result = {};
    					}
    					if ( saved !== result ) {

    						// Cancel the outer synthetic event
    						event.stopImmediatePropagation();
    						event.preventDefault();

    						// Support: Chrome 86+
    						// In Chrome, if an element having a focusout handler is blurred by
    						// clicking outside of it, it invokes the handler synchronously. If
    						// that handler calls `.remove()` on the element, the data is cleared,
    						// leaving `result` undefined. We need to guard against this.
    						return result && result.value;
    					}

    				// If this is an inner synthetic event for an event with a bubbling surrogate
    				// (focus or blur), assume that the surrogate already propagated from triggering the
    				// native event and prevent that from happening again here.
    				// This technically gets the ordering wrong w.r.t. to `.trigger()` (in which the
    				// bubbling surrogate propagates *after* the non-bubbling base), but that seems
    				// less bad than duplication.
    				} else if ( ( jQuery.event.special[ type ] || {} ).delegateType ) {
    					event.stopPropagation();
    				}

    			// If this is a native event triggered above, everything is now in order
    			// Fire an inner synthetic event with the original arguments
    			} else if ( saved.length ) {

    				// ...and capture the result
    				dataPriv.set( this, type, {
    					value: jQuery.event.trigger(

    						// Support: IE <=9 - 11+
    						// Extend with the prototype to reset the above stopImmediatePropagation()
    						jQuery.extend( saved[ 0 ], jQuery.Event.prototype ),
    						saved.slice( 1 ),
    						this
    					)
    				} );

    				// Abort handling of the native event
    				event.stopImmediatePropagation();
    			}
    		}
    	} );
    }

    jQuery.removeEvent = function( elem, type, handle ) {

    	// This "if" is needed for plain objects
    	if ( elem.removeEventListener ) {
    		elem.removeEventListener( type, handle );
    	}
    };

    jQuery.Event = function( src, props ) {

    	// Allow instantiation without the 'new' keyword
    	if ( !( this instanceof jQuery.Event ) ) {
    		return new jQuery.Event( src, props );
    	}

    	// Event object
    	if ( src && src.type ) {
    		this.originalEvent = src;
    		this.type = src.type;

    		// Events bubbling up the document may have been marked as prevented
    		// by a handler lower down the tree; reflect the correct value.
    		this.isDefaultPrevented = src.defaultPrevented ||
    				src.defaultPrevented === undefined &&

    				// Support: Android <=2.3 only
    				src.returnValue === false ?
    			returnTrue :
    			returnFalse;

    		// Create target properties
    		// Support: Safari <=6 - 7 only
    		// Target should not be a text node (#504, #13143)
    		this.target = ( src.target && src.target.nodeType === 3 ) ?
    			src.target.parentNode :
    			src.target;

    		this.currentTarget = src.currentTarget;
    		this.relatedTarget = src.relatedTarget;

    	// Event type
    	} else {
    		this.type = src;
    	}

    	// Put explicitly provided properties onto the event object
    	if ( props ) {
    		jQuery.extend( this, props );
    	}

    	// Create a timestamp if incoming event doesn't have one
    	this.timeStamp = src && src.timeStamp || Date.now();

    	// Mark it as fixed
    	this[ jQuery.expando ] = true;
    };

    // jQuery.Event is based on DOM3 Events as specified by the ECMAScript Language Binding
    // https://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
    jQuery.Event.prototype = {
    	constructor: jQuery.Event,
    	isDefaultPrevented: returnFalse,
    	isPropagationStopped: returnFalse,
    	isImmediatePropagationStopped: returnFalse,
    	isSimulated: false,

    	preventDefault: function() {
    		var e = this.originalEvent;

    		this.isDefaultPrevented = returnTrue;

    		if ( e && !this.isSimulated ) {
    			e.preventDefault();
    		}
    	},
    	stopPropagation: function() {
    		var e = this.originalEvent;

    		this.isPropagationStopped = returnTrue;

    		if ( e && !this.isSimulated ) {
    			e.stopPropagation();
    		}
    	},
    	stopImmediatePropagation: function() {
    		var e = this.originalEvent;

    		this.isImmediatePropagationStopped = returnTrue;

    		if ( e && !this.isSimulated ) {
    			e.stopImmediatePropagation();
    		}

    		this.stopPropagation();
    	}
    };

    // Includes all common event props including KeyEvent and MouseEvent specific props
    jQuery.each( {
    	altKey: true,
    	bubbles: true,
    	cancelable: true,
    	changedTouches: true,
    	ctrlKey: true,
    	detail: true,
    	eventPhase: true,
    	metaKey: true,
    	pageX: true,
    	pageY: true,
    	shiftKey: true,
    	view: true,
    	"char": true,
    	code: true,
    	charCode: true,
    	key: true,
    	keyCode: true,
    	button: true,
    	buttons: true,
    	clientX: true,
    	clientY: true,
    	offsetX: true,
    	offsetY: true,
    	pointerId: true,
    	pointerType: true,
    	screenX: true,
    	screenY: true,
    	targetTouches: true,
    	toElement: true,
    	touches: true,
    	which: true
    }, jQuery.event.addProp );

    jQuery.each( { focus: "focusin", blur: "focusout" }, function( type, delegateType ) {
    	jQuery.event.special[ type ] = {

    		// Utilize native event if possible so blur/focus sequence is correct
    		setup: function() {

    			// Claim the first handler
    			// dataPriv.set( this, "focus", ... )
    			// dataPriv.set( this, "blur", ... )
    			leverageNative( this, type, expectSync );

    			// Return false to allow normal processing in the caller
    			return false;
    		},
    		trigger: function() {

    			// Force setup before trigger
    			leverageNative( this, type );

    			// Return non-false to allow normal event-path propagation
    			return true;
    		},

    		// Suppress native focus or blur as it's already being fired
    		// in leverageNative.
    		_default: function() {
    			return true;
    		},

    		delegateType: delegateType
    	};
    } );

    // Create mouseenter/leave events using mouseover/out and event-time checks
    // so that event delegation works in jQuery.
    // Do the same for pointerenter/pointerleave and pointerover/pointerout
    //
    // Support: Safari 7 only
    // Safari sends mouseenter too often; see:
    // https://bugs.chromium.org/p/chromium/issues/detail?id=470258
    // for the description of the bug (it existed in older Chrome versions as well).
    jQuery.each( {
    	mouseenter: "mouseover",
    	mouseleave: "mouseout",
    	pointerenter: "pointerover",
    	pointerleave: "pointerout"
    }, function( orig, fix ) {
    	jQuery.event.special[ orig ] = {
    		delegateType: fix,
    		bindType: fix,

    		handle: function( event ) {
    			var ret,
    				target = this,
    				related = event.relatedTarget,
    				handleObj = event.handleObj;

    			// For mouseenter/leave call the handler if related is outside the target.
    			// NB: No relatedTarget if the mouse left/entered the browser window
    			if ( !related || ( related !== target && !jQuery.contains( target, related ) ) ) {
    				event.type = handleObj.origType;
    				ret = handleObj.handler.apply( this, arguments );
    				event.type = fix;
    			}
    			return ret;
    		}
    	};
    } );

    jQuery.fn.extend( {

    	on: function( types, selector, data, fn ) {
    		return on( this, types, selector, data, fn );
    	},
    	one: function( types, selector, data, fn ) {
    		return on( this, types, selector, data, fn, 1 );
    	},
    	off: function( types, selector, fn ) {
    		var handleObj, type;
    		if ( types && types.preventDefault && types.handleObj ) {

    			// ( event )  dispatched jQuery.Event
    			handleObj = types.handleObj;
    			jQuery( types.delegateTarget ).off(
    				handleObj.namespace ?
    					handleObj.origType + "." + handleObj.namespace :
    					handleObj.origType,
    				handleObj.selector,
    				handleObj.handler
    			);
    			return this;
    		}
    		if ( typeof types === "object" ) {

    			// ( types-object [, selector] )
    			for ( type in types ) {
    				this.off( type, selector, types[ type ] );
    			}
    			return this;
    		}
    		if ( selector === false || typeof selector === "function" ) {

    			// ( types [, fn] )
    			fn = selector;
    			selector = undefined;
    		}
    		if ( fn === false ) {
    			fn = returnFalse;
    		}
    		return this.each( function() {
    			jQuery.event.remove( this, types, fn, selector );
    		} );
    	}
    } );


    var

    	// Support: IE <=10 - 11, Edge 12 - 13 only
    	// In IE/Edge using regex groups here causes severe slowdowns.
    	// See https://connect.microsoft.com/IE/feedback/details/1736512/
    	rnoInnerhtml = /<script|<style|<link/i,

    	// checked="checked" or checked
    	rchecked = /checked\s*(?:[^=]|=\s*.checked.)/i,
    	rcleanScript = /^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g;

    // Prefer a tbody over its parent table for containing new rows
    function manipulationTarget( elem, content ) {
    	if ( nodeName( elem, "table" ) &&
    		nodeName( content.nodeType !== 11 ? content : content.firstChild, "tr" ) ) {

    		return jQuery( elem ).children( "tbody" )[ 0 ] || elem;
    	}

    	return elem;
    }

    // Replace/restore the type attribute of script elements for safe DOM manipulation
    function disableScript( elem ) {
    	elem.type = ( elem.getAttribute( "type" ) !== null ) + "/" + elem.type;
    	return elem;
    }
    function restoreScript( elem ) {
    	if ( ( elem.type || "" ).slice( 0, 5 ) === "true/" ) {
    		elem.type = elem.type.slice( 5 );
    	} else {
    		elem.removeAttribute( "type" );
    	}

    	return elem;
    }

    function cloneCopyEvent( src, dest ) {
    	var i, l, type, pdataOld, udataOld, udataCur, events;

    	if ( dest.nodeType !== 1 ) {
    		return;
    	}

    	// 1. Copy private data: events, handlers, etc.
    	if ( dataPriv.hasData( src ) ) {
    		pdataOld = dataPriv.get( src );
    		events = pdataOld.events;

    		if ( events ) {
    			dataPriv.remove( dest, "handle events" );

    			for ( type in events ) {
    				for ( i = 0, l = events[ type ].length; i < l; i++ ) {
    					jQuery.event.add( dest, type, events[ type ][ i ] );
    				}
    			}
    		}
    	}

    	// 2. Copy user data
    	if ( dataUser.hasData( src ) ) {
    		udataOld = dataUser.access( src );
    		udataCur = jQuery.extend( {}, udataOld );

    		dataUser.set( dest, udataCur );
    	}
    }

    // Fix IE bugs, see support tests
    function fixInput( src, dest ) {
    	var nodeName = dest.nodeName.toLowerCase();

    	// Fails to persist the checked state of a cloned checkbox or radio button.
    	if ( nodeName === "input" && rcheckableType.test( src.type ) ) {
    		dest.checked = src.checked;

    	// Fails to return the selected option to the default selected state when cloning options
    	} else if ( nodeName === "input" || nodeName === "textarea" ) {
    		dest.defaultValue = src.defaultValue;
    	}
    }

    function domManip( collection, args, callback, ignored ) {

    	// Flatten any nested arrays
    	args = flat( args );

    	var fragment, first, scripts, hasScripts, node, doc,
    		i = 0,
    		l = collection.length,
    		iNoClone = l - 1,
    		value = args[ 0 ],
    		valueIsFunction = isFunction( value );

    	// We can't cloneNode fragments that contain checked, in WebKit
    	if ( valueIsFunction ||
    			( l > 1 && typeof value === "string" &&
    				!support.checkClone && rchecked.test( value ) ) ) {
    		return collection.each( function( index ) {
    			var self = collection.eq( index );
    			if ( valueIsFunction ) {
    				args[ 0 ] = value.call( this, index, self.html() );
    			}
    			domManip( self, args, callback, ignored );
    		} );
    	}

    	if ( l ) {
    		fragment = buildFragment( args, collection[ 0 ].ownerDocument, false, collection, ignored );
    		first = fragment.firstChild;

    		if ( fragment.childNodes.length === 1 ) {
    			fragment = first;
    		}

    		// Require either new content or an interest in ignored elements to invoke the callback
    		if ( first || ignored ) {
    			scripts = jQuery.map( getAll( fragment, "script" ), disableScript );
    			hasScripts = scripts.length;

    			// Use the original fragment for the last item
    			// instead of the first because it can end up
    			// being emptied incorrectly in certain situations (#8070).
    			for ( ; i < l; i++ ) {
    				node = fragment;

    				if ( i !== iNoClone ) {
    					node = jQuery.clone( node, true, true );

    					// Keep references to cloned scripts for later restoration
    					if ( hasScripts ) {

    						// Support: Android <=4.0 only, PhantomJS 1 only
    						// push.apply(_, arraylike) throws on ancient WebKit
    						jQuery.merge( scripts, getAll( node, "script" ) );
    					}
    				}

    				callback.call( collection[ i ], node, i );
    			}

    			if ( hasScripts ) {
    				doc = scripts[ scripts.length - 1 ].ownerDocument;

    				// Reenable scripts
    				jQuery.map( scripts, restoreScript );

    				// Evaluate executable scripts on first document insertion
    				for ( i = 0; i < hasScripts; i++ ) {
    					node = scripts[ i ];
    					if ( rscriptType.test( node.type || "" ) &&
    						!dataPriv.access( node, "globalEval" ) &&
    						jQuery.contains( doc, node ) ) {

    						if ( node.src && ( node.type || "" ).toLowerCase()  !== "module" ) {

    							// Optional AJAX dependency, but won't run scripts if not present
    							if ( jQuery._evalUrl && !node.noModule ) {
    								jQuery._evalUrl( node.src, {
    									nonce: node.nonce || node.getAttribute( "nonce" )
    								}, doc );
    							}
    						} else {
    							DOMEval( node.textContent.replace( rcleanScript, "" ), node, doc );
    						}
    					}
    				}
    			}
    		}
    	}

    	return collection;
    }

    function remove( elem, selector, keepData ) {
    	var node,
    		nodes = selector ? jQuery.filter( selector, elem ) : elem,
    		i = 0;

    	for ( ; ( node = nodes[ i ] ) != null; i++ ) {
    		if ( !keepData && node.nodeType === 1 ) {
    			jQuery.cleanData( getAll( node ) );
    		}

    		if ( node.parentNode ) {
    			if ( keepData && isAttached( node ) ) {
    				setGlobalEval( getAll( node, "script" ) );
    			}
    			node.parentNode.removeChild( node );
    		}
    	}

    	return elem;
    }

    jQuery.extend( {
    	htmlPrefilter: function( html ) {
    		return html;
    	},

    	clone: function( elem, dataAndEvents, deepDataAndEvents ) {
    		var i, l, srcElements, destElements,
    			clone = elem.cloneNode( true ),
    			inPage = isAttached( elem );

    		// Fix IE cloning issues
    		if ( !support.noCloneChecked && ( elem.nodeType === 1 || elem.nodeType === 11 ) &&
    				!jQuery.isXMLDoc( elem ) ) {

    			// We eschew Sizzle here for performance reasons: https://jsperf.com/getall-vs-sizzle/2
    			destElements = getAll( clone );
    			srcElements = getAll( elem );

    			for ( i = 0, l = srcElements.length; i < l; i++ ) {
    				fixInput( srcElements[ i ], destElements[ i ] );
    			}
    		}

    		// Copy the events from the original to the clone
    		if ( dataAndEvents ) {
    			if ( deepDataAndEvents ) {
    				srcElements = srcElements || getAll( elem );
    				destElements = destElements || getAll( clone );

    				for ( i = 0, l = srcElements.length; i < l; i++ ) {
    					cloneCopyEvent( srcElements[ i ], destElements[ i ] );
    				}
    			} else {
    				cloneCopyEvent( elem, clone );
    			}
    		}

    		// Preserve script evaluation history
    		destElements = getAll( clone, "script" );
    		if ( destElements.length > 0 ) {
    			setGlobalEval( destElements, !inPage && getAll( elem, "script" ) );
    		}

    		// Return the cloned set
    		return clone;
    	},

    	cleanData: function( elems ) {
    		var data, elem, type,
    			special = jQuery.event.special,
    			i = 0;

    		for ( ; ( elem = elems[ i ] ) !== undefined; i++ ) {
    			if ( acceptData( elem ) ) {
    				if ( ( data = elem[ dataPriv.expando ] ) ) {
    					if ( data.events ) {
    						for ( type in data.events ) {
    							if ( special[ type ] ) {
    								jQuery.event.remove( elem, type );

    							// This is a shortcut to avoid jQuery.event.remove's overhead
    							} else {
    								jQuery.removeEvent( elem, type, data.handle );
    							}
    						}
    					}

    					// Support: Chrome <=35 - 45+
    					// Assign undefined instead of using delete, see Data#remove
    					elem[ dataPriv.expando ] = undefined;
    				}
    				if ( elem[ dataUser.expando ] ) {

    					// Support: Chrome <=35 - 45+
    					// Assign undefined instead of using delete, see Data#remove
    					elem[ dataUser.expando ] = undefined;
    				}
    			}
    		}
    	}
    } );

    jQuery.fn.extend( {
    	detach: function( selector ) {
    		return remove( this, selector, true );
    	},

    	remove: function( selector ) {
    		return remove( this, selector );
    	},

    	text: function( value ) {
    		return access( this, function( value ) {
    			return value === undefined ?
    				jQuery.text( this ) :
    				this.empty().each( function() {
    					if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
    						this.textContent = value;
    					}
    				} );
    		}, null, value, arguments.length );
    	},

    	append: function() {
    		return domManip( this, arguments, function( elem ) {
    			if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
    				var target = manipulationTarget( this, elem );
    				target.appendChild( elem );
    			}
    		} );
    	},

    	prepend: function() {
    		return domManip( this, arguments, function( elem ) {
    			if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
    				var target = manipulationTarget( this, elem );
    				target.insertBefore( elem, target.firstChild );
    			}
    		} );
    	},

    	before: function() {
    		return domManip( this, arguments, function( elem ) {
    			if ( this.parentNode ) {
    				this.parentNode.insertBefore( elem, this );
    			}
    		} );
    	},

    	after: function() {
    		return domManip( this, arguments, function( elem ) {
    			if ( this.parentNode ) {
    				this.parentNode.insertBefore( elem, this.nextSibling );
    			}
    		} );
    	},

    	empty: function() {
    		var elem,
    			i = 0;

    		for ( ; ( elem = this[ i ] ) != null; i++ ) {
    			if ( elem.nodeType === 1 ) {

    				// Prevent memory leaks
    				jQuery.cleanData( getAll( elem, false ) );

    				// Remove any remaining nodes
    				elem.textContent = "";
    			}
    		}

    		return this;
    	},

    	clone: function( dataAndEvents, deepDataAndEvents ) {
    		dataAndEvents = dataAndEvents == null ? false : dataAndEvents;
    		deepDataAndEvents = deepDataAndEvents == null ? dataAndEvents : deepDataAndEvents;

    		return this.map( function() {
    			return jQuery.clone( this, dataAndEvents, deepDataAndEvents );
    		} );
    	},

    	html: function( value ) {
    		return access( this, function( value ) {
    			var elem = this[ 0 ] || {},
    				i = 0,
    				l = this.length;

    			if ( value === undefined && elem.nodeType === 1 ) {
    				return elem.innerHTML;
    			}

    			// See if we can take a shortcut and just use innerHTML
    			if ( typeof value === "string" && !rnoInnerhtml.test( value ) &&
    				!wrapMap[ ( rtagName.exec( value ) || [ "", "" ] )[ 1 ].toLowerCase() ] ) {

    				value = jQuery.htmlPrefilter( value );

    				try {
    					for ( ; i < l; i++ ) {
    						elem = this[ i ] || {};

    						// Remove element nodes and prevent memory leaks
    						if ( elem.nodeType === 1 ) {
    							jQuery.cleanData( getAll( elem, false ) );
    							elem.innerHTML = value;
    						}
    					}

    					elem = 0;

    				// If using innerHTML throws an exception, use the fallback method
    				} catch ( e ) {}
    			}

    			if ( elem ) {
    				this.empty().append( value );
    			}
    		}, null, value, arguments.length );
    	},

    	replaceWith: function() {
    		var ignored = [];

    		// Make the changes, replacing each non-ignored context element with the new content
    		return domManip( this, arguments, function( elem ) {
    			var parent = this.parentNode;

    			if ( jQuery.inArray( this, ignored ) < 0 ) {
    				jQuery.cleanData( getAll( this ) );
    				if ( parent ) {
    					parent.replaceChild( elem, this );
    				}
    			}

    		// Force callback invocation
    		}, ignored );
    	}
    } );

    jQuery.each( {
    	appendTo: "append",
    	prependTo: "prepend",
    	insertBefore: "before",
    	insertAfter: "after",
    	replaceAll: "replaceWith"
    }, function( name, original ) {
    	jQuery.fn[ name ] = function( selector ) {
    		var elems,
    			ret = [],
    			insert = jQuery( selector ),
    			last = insert.length - 1,
    			i = 0;

    		for ( ; i <= last; i++ ) {
    			elems = i === last ? this : this.clone( true );
    			jQuery( insert[ i ] )[ original ]( elems );

    			// Support: Android <=4.0 only, PhantomJS 1 only
    			// .get() because push.apply(_, arraylike) throws on ancient WebKit
    			push.apply( ret, elems.get() );
    		}

    		return this.pushStack( ret );
    	};
    } );
    var rnumnonpx = new RegExp( "^(" + pnum + ")(?!px)[a-z%]+$", "i" );

    var getStyles = function( elem ) {

    		// Support: IE <=11 only, Firefox <=30 (#15098, #14150)
    		// IE throws on elements created in popups
    		// FF meanwhile throws on frame elements through "defaultView.getComputedStyle"
    		var view = elem.ownerDocument.defaultView;

    		if ( !view || !view.opener ) {
    			view = window;
    		}

    		return view.getComputedStyle( elem );
    	};

    var swap = function( elem, options, callback ) {
    	var ret, name,
    		old = {};

    	// Remember the old values, and insert the new ones
    	for ( name in options ) {
    		old[ name ] = elem.style[ name ];
    		elem.style[ name ] = options[ name ];
    	}

    	ret = callback.call( elem );

    	// Revert the old values
    	for ( name in options ) {
    		elem.style[ name ] = old[ name ];
    	}

    	return ret;
    };


    var rboxStyle = new RegExp( cssExpand.join( "|" ), "i" );



    ( function() {

    	// Executing both pixelPosition & boxSizingReliable tests require only one layout
    	// so they're executed at the same time to save the second computation.
    	function computeStyleTests() {

    		// This is a singleton, we need to execute it only once
    		if ( !div ) {
    			return;
    		}

    		container.style.cssText = "position:absolute;left:-11111px;width:60px;" +
    			"margin-top:1px;padding:0;border:0";
    		div.style.cssText =
    			"position:relative;display:block;box-sizing:border-box;overflow:scroll;" +
    			"margin:auto;border:1px;padding:1px;" +
    			"width:60%;top:1%";
    		documentElement.appendChild( container ).appendChild( div );

    		var divStyle = window.getComputedStyle( div );
    		pixelPositionVal = divStyle.top !== "1%";

    		// Support: Android 4.0 - 4.3 only, Firefox <=3 - 44
    		reliableMarginLeftVal = roundPixelMeasures( divStyle.marginLeft ) === 12;

    		// Support: Android 4.0 - 4.3 only, Safari <=9.1 - 10.1, iOS <=7.0 - 9.3
    		// Some styles come back with percentage values, even though they shouldn't
    		div.style.right = "60%";
    		pixelBoxStylesVal = roundPixelMeasures( divStyle.right ) === 36;

    		// Support: IE 9 - 11 only
    		// Detect misreporting of content dimensions for box-sizing:border-box elements
    		boxSizingReliableVal = roundPixelMeasures( divStyle.width ) === 36;

    		// Support: IE 9 only
    		// Detect overflow:scroll screwiness (gh-3699)
    		// Support: Chrome <=64
    		// Don't get tricked when zoom affects offsetWidth (gh-4029)
    		div.style.position = "absolute";
    		scrollboxSizeVal = roundPixelMeasures( div.offsetWidth / 3 ) === 12;

    		documentElement.removeChild( container );

    		// Nullify the div so it wouldn't be stored in the memory and
    		// it will also be a sign that checks already performed
    		div = null;
    	}

    	function roundPixelMeasures( measure ) {
    		return Math.round( parseFloat( measure ) );
    	}

    	var pixelPositionVal, boxSizingReliableVal, scrollboxSizeVal, pixelBoxStylesVal,
    		reliableTrDimensionsVal, reliableMarginLeftVal,
    		container = document.createElement( "div" ),
    		div = document.createElement( "div" );

    	// Finish early in limited (non-browser) environments
    	if ( !div.style ) {
    		return;
    	}

    	// Support: IE <=9 - 11 only
    	// Style of cloned element affects source element cloned (#8908)
    	div.style.backgroundClip = "content-box";
    	div.cloneNode( true ).style.backgroundClip = "";
    	support.clearCloneStyle = div.style.backgroundClip === "content-box";

    	jQuery.extend( support, {
    		boxSizingReliable: function() {
    			computeStyleTests();
    			return boxSizingReliableVal;
    		},
    		pixelBoxStyles: function() {
    			computeStyleTests();
    			return pixelBoxStylesVal;
    		},
    		pixelPosition: function() {
    			computeStyleTests();
    			return pixelPositionVal;
    		},
    		reliableMarginLeft: function() {
    			computeStyleTests();
    			return reliableMarginLeftVal;
    		},
    		scrollboxSize: function() {
    			computeStyleTests();
    			return scrollboxSizeVal;
    		},

    		// Support: IE 9 - 11+, Edge 15 - 18+
    		// IE/Edge misreport `getComputedStyle` of table rows with width/height
    		// set in CSS while `offset*` properties report correct values.
    		// Behavior in IE 9 is more subtle than in newer versions & it passes
    		// some versions of this test; make sure not to make it pass there!
    		//
    		// Support: Firefox 70+
    		// Only Firefox includes border widths
    		// in computed dimensions. (gh-4529)
    		reliableTrDimensions: function() {
    			var table, tr, trChild, trStyle;
    			if ( reliableTrDimensionsVal == null ) {
    				table = document.createElement( "table" );
    				tr = document.createElement( "tr" );
    				trChild = document.createElement( "div" );

    				table.style.cssText = "position:absolute;left:-11111px;border-collapse:separate";
    				tr.style.cssText = "border:1px solid";

    				// Support: Chrome 86+
    				// Height set through cssText does not get applied.
    				// Computed height then comes back as 0.
    				tr.style.height = "1px";
    				trChild.style.height = "9px";

    				// Support: Android 8 Chrome 86+
    				// In our bodyBackground.html iframe,
    				// display for all div elements is set to "inline",
    				// which causes a problem only in Android 8 Chrome 86.
    				// Ensuring the div is display: block
    				// gets around this issue.
    				trChild.style.display = "block";

    				documentElement
    					.appendChild( table )
    					.appendChild( tr )
    					.appendChild( trChild );

    				trStyle = window.getComputedStyle( tr );
    				reliableTrDimensionsVal = ( parseInt( trStyle.height, 10 ) +
    					parseInt( trStyle.borderTopWidth, 10 ) +
    					parseInt( trStyle.borderBottomWidth, 10 ) ) === tr.offsetHeight;

    				documentElement.removeChild( table );
    			}
    			return reliableTrDimensionsVal;
    		}
    	} );
    } )();


    function curCSS( elem, name, computed ) {
    	var width, minWidth, maxWidth, ret,

    		// Support: Firefox 51+
    		// Retrieving style before computed somehow
    		// fixes an issue with getting wrong values
    		// on detached elements
    		style = elem.style;

    	computed = computed || getStyles( elem );

    	// getPropertyValue is needed for:
    	//   .css('filter') (IE 9 only, #12537)
    	//   .css('--customProperty) (#3144)
    	if ( computed ) {
    		ret = computed.getPropertyValue( name ) || computed[ name ];

    		if ( ret === "" && !isAttached( elem ) ) {
    			ret = jQuery.style( elem, name );
    		}

    		// A tribute to the "awesome hack by Dean Edwards"
    		// Android Browser returns percentage for some values,
    		// but width seems to be reliably pixels.
    		// This is against the CSSOM draft spec:
    		// https://drafts.csswg.org/cssom/#resolved-values
    		if ( !support.pixelBoxStyles() && rnumnonpx.test( ret ) && rboxStyle.test( name ) ) {

    			// Remember the original values
    			width = style.width;
    			minWidth = style.minWidth;
    			maxWidth = style.maxWidth;

    			// Put in the new values to get a computed value out
    			style.minWidth = style.maxWidth = style.width = ret;
    			ret = computed.width;

    			// Revert the changed values
    			style.width = width;
    			style.minWidth = minWidth;
    			style.maxWidth = maxWidth;
    		}
    	}

    	return ret !== undefined ?

    		// Support: IE <=9 - 11 only
    		// IE returns zIndex value as an integer.
    		ret + "" :
    		ret;
    }


    function addGetHookIf( conditionFn, hookFn ) {

    	// Define the hook, we'll check on the first run if it's really needed.
    	return {
    		get: function() {
    			if ( conditionFn() ) {

    				// Hook not needed (or it's not possible to use it due
    				// to missing dependency), remove it.
    				delete this.get;
    				return;
    			}

    			// Hook needed; redefine it so that the support test is not executed again.
    			return ( this.get = hookFn ).apply( this, arguments );
    		}
    	};
    }


    var cssPrefixes = [ "Webkit", "Moz", "ms" ],
    	emptyStyle = document.createElement( "div" ).style,
    	vendorProps = {};

    // Return a vendor-prefixed property or undefined
    function vendorPropName( name ) {

    	// Check for vendor prefixed names
    	var capName = name[ 0 ].toUpperCase() + name.slice( 1 ),
    		i = cssPrefixes.length;

    	while ( i-- ) {
    		name = cssPrefixes[ i ] + capName;
    		if ( name in emptyStyle ) {
    			return name;
    		}
    	}
    }

    // Return a potentially-mapped jQuery.cssProps or vendor prefixed property
    function finalPropName( name ) {
    	var final = jQuery.cssProps[ name ] || vendorProps[ name ];

    	if ( final ) {
    		return final;
    	}
    	if ( name in emptyStyle ) {
    		return name;
    	}
    	return vendorProps[ name ] = vendorPropName( name ) || name;
    }


    var

    	// Swappable if display is none or starts with table
    	// except "table", "table-cell", or "table-caption"
    	// See here for display values: https://developer.mozilla.org/en-US/docs/CSS/display
    	rdisplayswap = /^(none|table(?!-c[ea]).+)/,
    	rcustomProp = /^--/,
    	cssShow = { position: "absolute", visibility: "hidden", display: "block" },
    	cssNormalTransform = {
    		letterSpacing: "0",
    		fontWeight: "400"
    	};

    function setPositiveNumber( _elem, value, subtract ) {

    	// Any relative (+/-) values have already been
    	// normalized at this point
    	var matches = rcssNum.exec( value );
    	return matches ?

    		// Guard against undefined "subtract", e.g., when used as in cssHooks
    		Math.max( 0, matches[ 2 ] - ( subtract || 0 ) ) + ( matches[ 3 ] || "px" ) :
    		value;
    }

    function boxModelAdjustment( elem, dimension, box, isBorderBox, styles, computedVal ) {
    	var i = dimension === "width" ? 1 : 0,
    		extra = 0,
    		delta = 0;

    	// Adjustment may not be necessary
    	if ( box === ( isBorderBox ? "border" : "content" ) ) {
    		return 0;
    	}

    	for ( ; i < 4; i += 2 ) {

    		// Both box models exclude margin
    		if ( box === "margin" ) {
    			delta += jQuery.css( elem, box + cssExpand[ i ], true, styles );
    		}

    		// If we get here with a content-box, we're seeking "padding" or "border" or "margin"
    		if ( !isBorderBox ) {

    			// Add padding
    			delta += jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );

    			// For "border" or "margin", add border
    			if ( box !== "padding" ) {
    				delta += jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );

    			// But still keep track of it otherwise
    			} else {
    				extra += jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
    			}

    		// If we get here with a border-box (content + padding + border), we're seeking "content" or
    		// "padding" or "margin"
    		} else {

    			// For "content", subtract padding
    			if ( box === "content" ) {
    				delta -= jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );
    			}

    			// For "content" or "padding", subtract border
    			if ( box !== "margin" ) {
    				delta -= jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
    			}
    		}
    	}

    	// Account for positive content-box scroll gutter when requested by providing computedVal
    	if ( !isBorderBox && computedVal >= 0 ) {

    		// offsetWidth/offsetHeight is a rounded sum of content, padding, scroll gutter, and border
    		// Assuming integer scroll gutter, subtract the rest and round down
    		delta += Math.max( 0, Math.ceil(
    			elem[ "offset" + dimension[ 0 ].toUpperCase() + dimension.slice( 1 ) ] -
    			computedVal -
    			delta -
    			extra -
    			0.5

    		// If offsetWidth/offsetHeight is unknown, then we can't determine content-box scroll gutter
    		// Use an explicit zero to avoid NaN (gh-3964)
    		) ) || 0;
    	}

    	return delta;
    }

    function getWidthOrHeight( elem, dimension, extra ) {

    	// Start with computed style
    	var styles = getStyles( elem ),

    		// To avoid forcing a reflow, only fetch boxSizing if we need it (gh-4322).
    		// Fake content-box until we know it's needed to know the true value.
    		boxSizingNeeded = !support.boxSizingReliable() || extra,
    		isBorderBox = boxSizingNeeded &&
    			jQuery.css( elem, "boxSizing", false, styles ) === "border-box",
    		valueIsBorderBox = isBorderBox,

    		val = curCSS( elem, dimension, styles ),
    		offsetProp = "offset" + dimension[ 0 ].toUpperCase() + dimension.slice( 1 );

    	// Support: Firefox <=54
    	// Return a confounding non-pixel value or feign ignorance, as appropriate.
    	if ( rnumnonpx.test( val ) ) {
    		if ( !extra ) {
    			return val;
    		}
    		val = "auto";
    	}


    	// Support: IE 9 - 11 only
    	// Use offsetWidth/offsetHeight for when box sizing is unreliable.
    	// In those cases, the computed value can be trusted to be border-box.
    	if ( ( !support.boxSizingReliable() && isBorderBox ||

    		// Support: IE 10 - 11+, Edge 15 - 18+
    		// IE/Edge misreport `getComputedStyle` of table rows with width/height
    		// set in CSS while `offset*` properties report correct values.
    		// Interestingly, in some cases IE 9 doesn't suffer from this issue.
    		!support.reliableTrDimensions() && nodeName( elem, "tr" ) ||

    		// Fall back to offsetWidth/offsetHeight when value is "auto"
    		// This happens for inline elements with no explicit setting (gh-3571)
    		val === "auto" ||

    		// Support: Android <=4.1 - 4.3 only
    		// Also use offsetWidth/offsetHeight for misreported inline dimensions (gh-3602)
    		!parseFloat( val ) && jQuery.css( elem, "display", false, styles ) === "inline" ) &&

    		// Make sure the element is visible & connected
    		elem.getClientRects().length ) {

    		isBorderBox = jQuery.css( elem, "boxSizing", false, styles ) === "border-box";

    		// Where available, offsetWidth/offsetHeight approximate border box dimensions.
    		// Where not available (e.g., SVG), assume unreliable box-sizing and interpret the
    		// retrieved value as a content box dimension.
    		valueIsBorderBox = offsetProp in elem;
    		if ( valueIsBorderBox ) {
    			val = elem[ offsetProp ];
    		}
    	}

    	// Normalize "" and auto
    	val = parseFloat( val ) || 0;

    	// Adjust for the element's box model
    	return ( val +
    		boxModelAdjustment(
    			elem,
    			dimension,
    			extra || ( isBorderBox ? "border" : "content" ),
    			valueIsBorderBox,
    			styles,

    			// Provide the current computed size to request scroll gutter calculation (gh-3589)
    			val
    		)
    	) + "px";
    }

    jQuery.extend( {

    	// Add in style property hooks for overriding the default
    	// behavior of getting and setting a style property
    	cssHooks: {
    		opacity: {
    			get: function( elem, computed ) {
    				if ( computed ) {

    					// We should always get a number back from opacity
    					var ret = curCSS( elem, "opacity" );
    					return ret === "" ? "1" : ret;
    				}
    			}
    		}
    	},

    	// Don't automatically add "px" to these possibly-unitless properties
    	cssNumber: {
    		"animationIterationCount": true,
    		"columnCount": true,
    		"fillOpacity": true,
    		"flexGrow": true,
    		"flexShrink": true,
    		"fontWeight": true,
    		"gridArea": true,
    		"gridColumn": true,
    		"gridColumnEnd": true,
    		"gridColumnStart": true,
    		"gridRow": true,
    		"gridRowEnd": true,
    		"gridRowStart": true,
    		"lineHeight": true,
    		"opacity": true,
    		"order": true,
    		"orphans": true,
    		"widows": true,
    		"zIndex": true,
    		"zoom": true
    	},

    	// Add in properties whose names you wish to fix before
    	// setting or getting the value
    	cssProps: {},

    	// Get and set the style property on a DOM Node
    	style: function( elem, name, value, extra ) {

    		// Don't set styles on text and comment nodes
    		if ( !elem || elem.nodeType === 3 || elem.nodeType === 8 || !elem.style ) {
    			return;
    		}

    		// Make sure that we're working with the right name
    		var ret, type, hooks,
    			origName = camelCase( name ),
    			isCustomProp = rcustomProp.test( name ),
    			style = elem.style;

    		// Make sure that we're working with the right name. We don't
    		// want to query the value if it is a CSS custom property
    		// since they are user-defined.
    		if ( !isCustomProp ) {
    			name = finalPropName( origName );
    		}

    		// Gets hook for the prefixed version, then unprefixed version
    		hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

    		// Check if we're setting a value
    		if ( value !== undefined ) {
    			type = typeof value;

    			// Convert "+=" or "-=" to relative numbers (#7345)
    			if ( type === "string" && ( ret = rcssNum.exec( value ) ) && ret[ 1 ] ) {
    				value = adjustCSS( elem, name, ret );

    				// Fixes bug #9237
    				type = "number";
    			}

    			// Make sure that null and NaN values aren't set (#7116)
    			if ( value == null || value !== value ) {
    				return;
    			}

    			// If a number was passed in, add the unit (except for certain CSS properties)
    			// The isCustomProp check can be removed in jQuery 4.0 when we only auto-append
    			// "px" to a few hardcoded values.
    			if ( type === "number" && !isCustomProp ) {
    				value += ret && ret[ 3 ] || ( jQuery.cssNumber[ origName ] ? "" : "px" );
    			}

    			// background-* props affect original clone's values
    			if ( !support.clearCloneStyle && value === "" && name.indexOf( "background" ) === 0 ) {
    				style[ name ] = "inherit";
    			}

    			// If a hook was provided, use that value, otherwise just set the specified value
    			if ( !hooks || !( "set" in hooks ) ||
    				( value = hooks.set( elem, value, extra ) ) !== undefined ) {

    				if ( isCustomProp ) {
    					style.setProperty( name, value );
    				} else {
    					style[ name ] = value;
    				}
    			}

    		} else {

    			// If a hook was provided get the non-computed value from there
    			if ( hooks && "get" in hooks &&
    				( ret = hooks.get( elem, false, extra ) ) !== undefined ) {

    				return ret;
    			}

    			// Otherwise just get the value from the style object
    			return style[ name ];
    		}
    	},

    	css: function( elem, name, extra, styles ) {
    		var val, num, hooks,
    			origName = camelCase( name ),
    			isCustomProp = rcustomProp.test( name );

    		// Make sure that we're working with the right name. We don't
    		// want to modify the value if it is a CSS custom property
    		// since they are user-defined.
    		if ( !isCustomProp ) {
    			name = finalPropName( origName );
    		}

    		// Try prefixed name followed by the unprefixed name
    		hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

    		// If a hook was provided get the computed value from there
    		if ( hooks && "get" in hooks ) {
    			val = hooks.get( elem, true, extra );
    		}

    		// Otherwise, if a way to get the computed value exists, use that
    		if ( val === undefined ) {
    			val = curCSS( elem, name, styles );
    		}

    		// Convert "normal" to computed value
    		if ( val === "normal" && name in cssNormalTransform ) {
    			val = cssNormalTransform[ name ];
    		}

    		// Make numeric if forced or a qualifier was provided and val looks numeric
    		if ( extra === "" || extra ) {
    			num = parseFloat( val );
    			return extra === true || isFinite( num ) ? num || 0 : val;
    		}

    		return val;
    	}
    } );

    jQuery.each( [ "height", "width" ], function( _i, dimension ) {
    	jQuery.cssHooks[ dimension ] = {
    		get: function( elem, computed, extra ) {
    			if ( computed ) {

    				// Certain elements can have dimension info if we invisibly show them
    				// but it must have a current display style that would benefit
    				return rdisplayswap.test( jQuery.css( elem, "display" ) ) &&

    					// Support: Safari 8+
    					// Table columns in Safari have non-zero offsetWidth & zero
    					// getBoundingClientRect().width unless display is changed.
    					// Support: IE <=11 only
    					// Running getBoundingClientRect on a disconnected node
    					// in IE throws an error.
    					( !elem.getClientRects().length || !elem.getBoundingClientRect().width ) ?
    					swap( elem, cssShow, function() {
    						return getWidthOrHeight( elem, dimension, extra );
    					} ) :
    					getWidthOrHeight( elem, dimension, extra );
    			}
    		},

    		set: function( elem, value, extra ) {
    			var matches,
    				styles = getStyles( elem ),

    				// Only read styles.position if the test has a chance to fail
    				// to avoid forcing a reflow.
    				scrollboxSizeBuggy = !support.scrollboxSize() &&
    					styles.position === "absolute",

    				// To avoid forcing a reflow, only fetch boxSizing if we need it (gh-3991)
    				boxSizingNeeded = scrollboxSizeBuggy || extra,
    				isBorderBox = boxSizingNeeded &&
    					jQuery.css( elem, "boxSizing", false, styles ) === "border-box",
    				subtract = extra ?
    					boxModelAdjustment(
    						elem,
    						dimension,
    						extra,
    						isBorderBox,
    						styles
    					) :
    					0;

    			// Account for unreliable border-box dimensions by comparing offset* to computed and
    			// faking a content-box to get border and padding (gh-3699)
    			if ( isBorderBox && scrollboxSizeBuggy ) {
    				subtract -= Math.ceil(
    					elem[ "offset" + dimension[ 0 ].toUpperCase() + dimension.slice( 1 ) ] -
    					parseFloat( styles[ dimension ] ) -
    					boxModelAdjustment( elem, dimension, "border", false, styles ) -
    					0.5
    				);
    			}

    			// Convert to pixels if value adjustment is needed
    			if ( subtract && ( matches = rcssNum.exec( value ) ) &&
    				( matches[ 3 ] || "px" ) !== "px" ) {

    				elem.style[ dimension ] = value;
    				value = jQuery.css( elem, dimension );
    			}

    			return setPositiveNumber( elem, value, subtract );
    		}
    	};
    } );

    jQuery.cssHooks.marginLeft = addGetHookIf( support.reliableMarginLeft,
    	function( elem, computed ) {
    		if ( computed ) {
    			return ( parseFloat( curCSS( elem, "marginLeft" ) ) ||
    				elem.getBoundingClientRect().left -
    					swap( elem, { marginLeft: 0 }, function() {
    						return elem.getBoundingClientRect().left;
    					} )
    			) + "px";
    		}
    	}
    );

    // These hooks are used by animate to expand properties
    jQuery.each( {
    	margin: "",
    	padding: "",
    	border: "Width"
    }, function( prefix, suffix ) {
    	jQuery.cssHooks[ prefix + suffix ] = {
    		expand: function( value ) {
    			var i = 0,
    				expanded = {},

    				// Assumes a single number if not a string
    				parts = typeof value === "string" ? value.split( " " ) : [ value ];

    			for ( ; i < 4; i++ ) {
    				expanded[ prefix + cssExpand[ i ] + suffix ] =
    					parts[ i ] || parts[ i - 2 ] || parts[ 0 ];
    			}

    			return expanded;
    		}
    	};

    	if ( prefix !== "margin" ) {
    		jQuery.cssHooks[ prefix + suffix ].set = setPositiveNumber;
    	}
    } );

    jQuery.fn.extend( {
    	css: function( name, value ) {
    		return access( this, function( elem, name, value ) {
    			var styles, len,
    				map = {},
    				i = 0;

    			if ( Array.isArray( name ) ) {
    				styles = getStyles( elem );
    				len = name.length;

    				for ( ; i < len; i++ ) {
    					map[ name[ i ] ] = jQuery.css( elem, name[ i ], false, styles );
    				}

    				return map;
    			}

    			return value !== undefined ?
    				jQuery.style( elem, name, value ) :
    				jQuery.css( elem, name );
    		}, name, value, arguments.length > 1 );
    	}
    } );


    function Tween( elem, options, prop, end, easing ) {
    	return new Tween.prototype.init( elem, options, prop, end, easing );
    }
    jQuery.Tween = Tween;

    Tween.prototype = {
    	constructor: Tween,
    	init: function( elem, options, prop, end, easing, unit ) {
    		this.elem = elem;
    		this.prop = prop;
    		this.easing = easing || jQuery.easing._default;
    		this.options = options;
    		this.start = this.now = this.cur();
    		this.end = end;
    		this.unit = unit || ( jQuery.cssNumber[ prop ] ? "" : "px" );
    	},
    	cur: function() {
    		var hooks = Tween.propHooks[ this.prop ];

    		return hooks && hooks.get ?
    			hooks.get( this ) :
    			Tween.propHooks._default.get( this );
    	},
    	run: function( percent ) {
    		var eased,
    			hooks = Tween.propHooks[ this.prop ];

    		if ( this.options.duration ) {
    			this.pos = eased = jQuery.easing[ this.easing ](
    				percent, this.options.duration * percent, 0, 1, this.options.duration
    			);
    		} else {
    			this.pos = eased = percent;
    		}
    		this.now = ( this.end - this.start ) * eased + this.start;

    		if ( this.options.step ) {
    			this.options.step.call( this.elem, this.now, this );
    		}

    		if ( hooks && hooks.set ) {
    			hooks.set( this );
    		} else {
    			Tween.propHooks._default.set( this );
    		}
    		return this;
    	}
    };

    Tween.prototype.init.prototype = Tween.prototype;

    Tween.propHooks = {
    	_default: {
    		get: function( tween ) {
    			var result;

    			// Use a property on the element directly when it is not a DOM element,
    			// or when there is no matching style property that exists.
    			if ( tween.elem.nodeType !== 1 ||
    				tween.elem[ tween.prop ] != null && tween.elem.style[ tween.prop ] == null ) {
    				return tween.elem[ tween.prop ];
    			}

    			// Passing an empty string as a 3rd parameter to .css will automatically
    			// attempt a parseFloat and fallback to a string if the parse fails.
    			// Simple values such as "10px" are parsed to Float;
    			// complex values such as "rotate(1rad)" are returned as-is.
    			result = jQuery.css( tween.elem, tween.prop, "" );

    			// Empty strings, null, undefined and "auto" are converted to 0.
    			return !result || result === "auto" ? 0 : result;
    		},
    		set: function( tween ) {

    			// Use step hook for back compat.
    			// Use cssHook if its there.
    			// Use .style if available and use plain properties where available.
    			if ( jQuery.fx.step[ tween.prop ] ) {
    				jQuery.fx.step[ tween.prop ]( tween );
    			} else if ( tween.elem.nodeType === 1 && (
    				jQuery.cssHooks[ tween.prop ] ||
    					tween.elem.style[ finalPropName( tween.prop ) ] != null ) ) {
    				jQuery.style( tween.elem, tween.prop, tween.now + tween.unit );
    			} else {
    				tween.elem[ tween.prop ] = tween.now;
    			}
    		}
    	}
    };

    // Support: IE <=9 only
    // Panic based approach to setting things on disconnected nodes
    Tween.propHooks.scrollTop = Tween.propHooks.scrollLeft = {
    	set: function( tween ) {
    		if ( tween.elem.nodeType && tween.elem.parentNode ) {
    			tween.elem[ tween.prop ] = tween.now;
    		}
    	}
    };

    jQuery.easing = {
    	linear: function( p ) {
    		return p;
    	},
    	swing: function( p ) {
    		return 0.5 - Math.cos( p * Math.PI ) / 2;
    	},
    	_default: "swing"
    };

    jQuery.fx = Tween.prototype.init;

    // Back compat <1.8 extension point
    jQuery.fx.step = {};




    var
    	fxNow, inProgress,
    	rfxtypes = /^(?:toggle|show|hide)$/,
    	rrun = /queueHooks$/;

    function schedule() {
    	if ( inProgress ) {
    		if ( document.hidden === false && window.requestAnimationFrame ) {
    			window.requestAnimationFrame( schedule );
    		} else {
    			window.setTimeout( schedule, jQuery.fx.interval );
    		}

    		jQuery.fx.tick();
    	}
    }

    // Animations created synchronously will run synchronously
    function createFxNow() {
    	window.setTimeout( function() {
    		fxNow = undefined;
    	} );
    	return ( fxNow = Date.now() );
    }

    // Generate parameters to create a standard animation
    function genFx( type, includeWidth ) {
    	var which,
    		i = 0,
    		attrs = { height: type };

    	// If we include width, step value is 1 to do all cssExpand values,
    	// otherwise step value is 2 to skip over Left and Right
    	includeWidth = includeWidth ? 1 : 0;
    	for ( ; i < 4; i += 2 - includeWidth ) {
    		which = cssExpand[ i ];
    		attrs[ "margin" + which ] = attrs[ "padding" + which ] = type;
    	}

    	if ( includeWidth ) {
    		attrs.opacity = attrs.width = type;
    	}

    	return attrs;
    }

    function createTween( value, prop, animation ) {
    	var tween,
    		collection = ( Animation.tweeners[ prop ] || [] ).concat( Animation.tweeners[ "*" ] ),
    		index = 0,
    		length = collection.length;
    	for ( ; index < length; index++ ) {
    		if ( ( tween = collection[ index ].call( animation, prop, value ) ) ) {

    			// We're done with this property
    			return tween;
    		}
    	}
    }

    function defaultPrefilter( elem, props, opts ) {
    	var prop, value, toggle, hooks, oldfire, propTween, restoreDisplay, display,
    		isBox = "width" in props || "height" in props,
    		anim = this,
    		orig = {},
    		style = elem.style,
    		hidden = elem.nodeType && isHiddenWithinTree( elem ),
    		dataShow = dataPriv.get( elem, "fxshow" );

    	// Queue-skipping animations hijack the fx hooks
    	if ( !opts.queue ) {
    		hooks = jQuery._queueHooks( elem, "fx" );
    		if ( hooks.unqueued == null ) {
    			hooks.unqueued = 0;
    			oldfire = hooks.empty.fire;
    			hooks.empty.fire = function() {
    				if ( !hooks.unqueued ) {
    					oldfire();
    				}
    			};
    		}
    		hooks.unqueued++;

    		anim.always( function() {

    			// Ensure the complete handler is called before this completes
    			anim.always( function() {
    				hooks.unqueued--;
    				if ( !jQuery.queue( elem, "fx" ).length ) {
    					hooks.empty.fire();
    				}
    			} );
    		} );
    	}

    	// Detect show/hide animations
    	for ( prop in props ) {
    		value = props[ prop ];
    		if ( rfxtypes.test( value ) ) {
    			delete props[ prop ];
    			toggle = toggle || value === "toggle";
    			if ( value === ( hidden ? "hide" : "show" ) ) {

    				// Pretend to be hidden if this is a "show" and
    				// there is still data from a stopped show/hide
    				if ( value === "show" && dataShow && dataShow[ prop ] !== undefined ) {
    					hidden = true;

    				// Ignore all other no-op show/hide data
    				} else {
    					continue;
    				}
    			}
    			orig[ prop ] = dataShow && dataShow[ prop ] || jQuery.style( elem, prop );
    		}
    	}

    	// Bail out if this is a no-op like .hide().hide()
    	propTween = !jQuery.isEmptyObject( props );
    	if ( !propTween && jQuery.isEmptyObject( orig ) ) {
    		return;
    	}

    	// Restrict "overflow" and "display" styles during box animations
    	if ( isBox && elem.nodeType === 1 ) {

    		// Support: IE <=9 - 11, Edge 12 - 15
    		// Record all 3 overflow attributes because IE does not infer the shorthand
    		// from identically-valued overflowX and overflowY and Edge just mirrors
    		// the overflowX value there.
    		opts.overflow = [ style.overflow, style.overflowX, style.overflowY ];

    		// Identify a display type, preferring old show/hide data over the CSS cascade
    		restoreDisplay = dataShow && dataShow.display;
    		if ( restoreDisplay == null ) {
    			restoreDisplay = dataPriv.get( elem, "display" );
    		}
    		display = jQuery.css( elem, "display" );
    		if ( display === "none" ) {
    			if ( restoreDisplay ) {
    				display = restoreDisplay;
    			} else {

    				// Get nonempty value(s) by temporarily forcing visibility
    				showHide( [ elem ], true );
    				restoreDisplay = elem.style.display || restoreDisplay;
    				display = jQuery.css( elem, "display" );
    				showHide( [ elem ] );
    			}
    		}

    		// Animate inline elements as inline-block
    		if ( display === "inline" || display === "inline-block" && restoreDisplay != null ) {
    			if ( jQuery.css( elem, "float" ) === "none" ) {

    				// Restore the original display value at the end of pure show/hide animations
    				if ( !propTween ) {
    					anim.done( function() {
    						style.display = restoreDisplay;
    					} );
    					if ( restoreDisplay == null ) {
    						display = style.display;
    						restoreDisplay = display === "none" ? "" : display;
    					}
    				}
    				style.display = "inline-block";
    			}
    		}
    	}

    	if ( opts.overflow ) {
    		style.overflow = "hidden";
    		anim.always( function() {
    			style.overflow = opts.overflow[ 0 ];
    			style.overflowX = opts.overflow[ 1 ];
    			style.overflowY = opts.overflow[ 2 ];
    		} );
    	}

    	// Implement show/hide animations
    	propTween = false;
    	for ( prop in orig ) {

    		// General show/hide setup for this element animation
    		if ( !propTween ) {
    			if ( dataShow ) {
    				if ( "hidden" in dataShow ) {
    					hidden = dataShow.hidden;
    				}
    			} else {
    				dataShow = dataPriv.access( elem, "fxshow", { display: restoreDisplay } );
    			}

    			// Store hidden/visible for toggle so `.stop().toggle()` "reverses"
    			if ( toggle ) {
    				dataShow.hidden = !hidden;
    			}

    			// Show elements before animating them
    			if ( hidden ) {
    				showHide( [ elem ], true );
    			}

    			/* eslint-disable no-loop-func */

    			anim.done( function() {

    				/* eslint-enable no-loop-func */

    				// The final step of a "hide" animation is actually hiding the element
    				if ( !hidden ) {
    					showHide( [ elem ] );
    				}
    				dataPriv.remove( elem, "fxshow" );
    				for ( prop in orig ) {
    					jQuery.style( elem, prop, orig[ prop ] );
    				}
    			} );
    		}

    		// Per-property setup
    		propTween = createTween( hidden ? dataShow[ prop ] : 0, prop, anim );
    		if ( !( prop in dataShow ) ) {
    			dataShow[ prop ] = propTween.start;
    			if ( hidden ) {
    				propTween.end = propTween.start;
    				propTween.start = 0;
    			}
    		}
    	}
    }

    function propFilter( props, specialEasing ) {
    	var index, name, easing, value, hooks;

    	// camelCase, specialEasing and expand cssHook pass
    	for ( index in props ) {
    		name = camelCase( index );
    		easing = specialEasing[ name ];
    		value = props[ index ];
    		if ( Array.isArray( value ) ) {
    			easing = value[ 1 ];
    			value = props[ index ] = value[ 0 ];
    		}

    		if ( index !== name ) {
    			props[ name ] = value;
    			delete props[ index ];
    		}

    		hooks = jQuery.cssHooks[ name ];
    		if ( hooks && "expand" in hooks ) {
    			value = hooks.expand( value );
    			delete props[ name ];

    			// Not quite $.extend, this won't overwrite existing keys.
    			// Reusing 'index' because we have the correct "name"
    			for ( index in value ) {
    				if ( !( index in props ) ) {
    					props[ index ] = value[ index ];
    					specialEasing[ index ] = easing;
    				}
    			}
    		} else {
    			specialEasing[ name ] = easing;
    		}
    	}
    }

    function Animation( elem, properties, options ) {
    	var result,
    		stopped,
    		index = 0,
    		length = Animation.prefilters.length,
    		deferred = jQuery.Deferred().always( function() {

    			// Don't match elem in the :animated selector
    			delete tick.elem;
    		} ),
    		tick = function() {
    			if ( stopped ) {
    				return false;
    			}
    			var currentTime = fxNow || createFxNow(),
    				remaining = Math.max( 0, animation.startTime + animation.duration - currentTime ),

    				// Support: Android 2.3 only
    				// Archaic crash bug won't allow us to use `1 - ( 0.5 || 0 )` (#12497)
    				temp = remaining / animation.duration || 0,
    				percent = 1 - temp,
    				index = 0,
    				length = animation.tweens.length;

    			for ( ; index < length; index++ ) {
    				animation.tweens[ index ].run( percent );
    			}

    			deferred.notifyWith( elem, [ animation, percent, remaining ] );

    			// If there's more to do, yield
    			if ( percent < 1 && length ) {
    				return remaining;
    			}

    			// If this was an empty animation, synthesize a final progress notification
    			if ( !length ) {
    				deferred.notifyWith( elem, [ animation, 1, 0 ] );
    			}

    			// Resolve the animation and report its conclusion
    			deferred.resolveWith( elem, [ animation ] );
    			return false;
    		},
    		animation = deferred.promise( {
    			elem: elem,
    			props: jQuery.extend( {}, properties ),
    			opts: jQuery.extend( true, {
    				specialEasing: {},
    				easing: jQuery.easing._default
    			}, options ),
    			originalProperties: properties,
    			originalOptions: options,
    			startTime: fxNow || createFxNow(),
    			duration: options.duration,
    			tweens: [],
    			createTween: function( prop, end ) {
    				var tween = jQuery.Tween( elem, animation.opts, prop, end,
    					animation.opts.specialEasing[ prop ] || animation.opts.easing );
    				animation.tweens.push( tween );
    				return tween;
    			},
    			stop: function( gotoEnd ) {
    				var index = 0,

    					// If we are going to the end, we want to run all the tweens
    					// otherwise we skip this part
    					length = gotoEnd ? animation.tweens.length : 0;
    				if ( stopped ) {
    					return this;
    				}
    				stopped = true;
    				for ( ; index < length; index++ ) {
    					animation.tweens[ index ].run( 1 );
    				}

    				// Resolve when we played the last frame; otherwise, reject
    				if ( gotoEnd ) {
    					deferred.notifyWith( elem, [ animation, 1, 0 ] );
    					deferred.resolveWith( elem, [ animation, gotoEnd ] );
    				} else {
    					deferred.rejectWith( elem, [ animation, gotoEnd ] );
    				}
    				return this;
    			}
    		} ),
    		props = animation.props;

    	propFilter( props, animation.opts.specialEasing );

    	for ( ; index < length; index++ ) {
    		result = Animation.prefilters[ index ].call( animation, elem, props, animation.opts );
    		if ( result ) {
    			if ( isFunction( result.stop ) ) {
    				jQuery._queueHooks( animation.elem, animation.opts.queue ).stop =
    					result.stop.bind( result );
    			}
    			return result;
    		}
    	}

    	jQuery.map( props, createTween, animation );

    	if ( isFunction( animation.opts.start ) ) {
    		animation.opts.start.call( elem, animation );
    	}

    	// Attach callbacks from options
    	animation
    		.progress( animation.opts.progress )
    		.done( animation.opts.done, animation.opts.complete )
    		.fail( animation.opts.fail )
    		.always( animation.opts.always );

    	jQuery.fx.timer(
    		jQuery.extend( tick, {
    			elem: elem,
    			anim: animation,
    			queue: animation.opts.queue
    		} )
    	);

    	return animation;
    }

    jQuery.Animation = jQuery.extend( Animation, {

    	tweeners: {
    		"*": [ function( prop, value ) {
    			var tween = this.createTween( prop, value );
    			adjustCSS( tween.elem, prop, rcssNum.exec( value ), tween );
    			return tween;
    		} ]
    	},

    	tweener: function( props, callback ) {
    		if ( isFunction( props ) ) {
    			callback = props;
    			props = [ "*" ];
    		} else {
    			props = props.match( rnothtmlwhite );
    		}

    		var prop,
    			index = 0,
    			length = props.length;

    		for ( ; index < length; index++ ) {
    			prop = props[ index ];
    			Animation.tweeners[ prop ] = Animation.tweeners[ prop ] || [];
    			Animation.tweeners[ prop ].unshift( callback );
    		}
    	},

    	prefilters: [ defaultPrefilter ],

    	prefilter: function( callback, prepend ) {
    		if ( prepend ) {
    			Animation.prefilters.unshift( callback );
    		} else {
    			Animation.prefilters.push( callback );
    		}
    	}
    } );

    jQuery.speed = function( speed, easing, fn ) {
    	var opt = speed && typeof speed === "object" ? jQuery.extend( {}, speed ) : {
    		complete: fn || !fn && easing ||
    			isFunction( speed ) && speed,
    		duration: speed,
    		easing: fn && easing || easing && !isFunction( easing ) && easing
    	};

    	// Go to the end state if fx are off
    	if ( jQuery.fx.off ) {
    		opt.duration = 0;

    	} else {
    		if ( typeof opt.duration !== "number" ) {
    			if ( opt.duration in jQuery.fx.speeds ) {
    				opt.duration = jQuery.fx.speeds[ opt.duration ];

    			} else {
    				opt.duration = jQuery.fx.speeds._default;
    			}
    		}
    	}

    	// Normalize opt.queue - true/undefined/null -> "fx"
    	if ( opt.queue == null || opt.queue === true ) {
    		opt.queue = "fx";
    	}

    	// Queueing
    	opt.old = opt.complete;

    	opt.complete = function() {
    		if ( isFunction( opt.old ) ) {
    			opt.old.call( this );
    		}

    		if ( opt.queue ) {
    			jQuery.dequeue( this, opt.queue );
    		}
    	};

    	return opt;
    };

    jQuery.fn.extend( {
    	fadeTo: function( speed, to, easing, callback ) {

    		// Show any hidden elements after setting opacity to 0
    		return this.filter( isHiddenWithinTree ).css( "opacity", 0 ).show()

    			// Animate to the value specified
    			.end().animate( { opacity: to }, speed, easing, callback );
    	},
    	animate: function( prop, speed, easing, callback ) {
    		var empty = jQuery.isEmptyObject( prop ),
    			optall = jQuery.speed( speed, easing, callback ),
    			doAnimation = function() {

    				// Operate on a copy of prop so per-property easing won't be lost
    				var anim = Animation( this, jQuery.extend( {}, prop ), optall );

    				// Empty animations, or finishing resolves immediately
    				if ( empty || dataPriv.get( this, "finish" ) ) {
    					anim.stop( true );
    				}
    			};

    		doAnimation.finish = doAnimation;

    		return empty || optall.queue === false ?
    			this.each( doAnimation ) :
    			this.queue( optall.queue, doAnimation );
    	},
    	stop: function( type, clearQueue, gotoEnd ) {
    		var stopQueue = function( hooks ) {
    			var stop = hooks.stop;
    			delete hooks.stop;
    			stop( gotoEnd );
    		};

    		if ( typeof type !== "string" ) {
    			gotoEnd = clearQueue;
    			clearQueue = type;
    			type = undefined;
    		}
    		if ( clearQueue ) {
    			this.queue( type || "fx", [] );
    		}

    		return this.each( function() {
    			var dequeue = true,
    				index = type != null && type + "queueHooks",
    				timers = jQuery.timers,
    				data = dataPriv.get( this );

    			if ( index ) {
    				if ( data[ index ] && data[ index ].stop ) {
    					stopQueue( data[ index ] );
    				}
    			} else {
    				for ( index in data ) {
    					if ( data[ index ] && data[ index ].stop && rrun.test( index ) ) {
    						stopQueue( data[ index ] );
    					}
    				}
    			}

    			for ( index = timers.length; index--; ) {
    				if ( timers[ index ].elem === this &&
    					( type == null || timers[ index ].queue === type ) ) {

    					timers[ index ].anim.stop( gotoEnd );
    					dequeue = false;
    					timers.splice( index, 1 );
    				}
    			}

    			// Start the next in the queue if the last step wasn't forced.
    			// Timers currently will call their complete callbacks, which
    			// will dequeue but only if they were gotoEnd.
    			if ( dequeue || !gotoEnd ) {
    				jQuery.dequeue( this, type );
    			}
    		} );
    	},
    	finish: function( type ) {
    		if ( type !== false ) {
    			type = type || "fx";
    		}
    		return this.each( function() {
    			var index,
    				data = dataPriv.get( this ),
    				queue = data[ type + "queue" ],
    				hooks = data[ type + "queueHooks" ],
    				timers = jQuery.timers,
    				length = queue ? queue.length : 0;

    			// Enable finishing flag on private data
    			data.finish = true;

    			// Empty the queue first
    			jQuery.queue( this, type, [] );

    			if ( hooks && hooks.stop ) {
    				hooks.stop.call( this, true );
    			}

    			// Look for any active animations, and finish them
    			for ( index = timers.length; index--; ) {
    				if ( timers[ index ].elem === this && timers[ index ].queue === type ) {
    					timers[ index ].anim.stop( true );
    					timers.splice( index, 1 );
    				}
    			}

    			// Look for any animations in the old queue and finish them
    			for ( index = 0; index < length; index++ ) {
    				if ( queue[ index ] && queue[ index ].finish ) {
    					queue[ index ].finish.call( this );
    				}
    			}

    			// Turn off finishing flag
    			delete data.finish;
    		} );
    	}
    } );

    jQuery.each( [ "toggle", "show", "hide" ], function( _i, name ) {
    	var cssFn = jQuery.fn[ name ];
    	jQuery.fn[ name ] = function( speed, easing, callback ) {
    		return speed == null || typeof speed === "boolean" ?
    			cssFn.apply( this, arguments ) :
    			this.animate( genFx( name, true ), speed, easing, callback );
    	};
    } );

    // Generate shortcuts for custom animations
    jQuery.each( {
    	slideDown: genFx( "show" ),
    	slideUp: genFx( "hide" ),
    	slideToggle: genFx( "toggle" ),
    	fadeIn: { opacity: "show" },
    	fadeOut: { opacity: "hide" },
    	fadeToggle: { opacity: "toggle" }
    }, function( name, props ) {
    	jQuery.fn[ name ] = function( speed, easing, callback ) {
    		return this.animate( props, speed, easing, callback );
    	};
    } );

    jQuery.timers = [];
    jQuery.fx.tick = function() {
    	var timer,
    		i = 0,
    		timers = jQuery.timers;

    	fxNow = Date.now();

    	for ( ; i < timers.length; i++ ) {
    		timer = timers[ i ];

    		// Run the timer and safely remove it when done (allowing for external removal)
    		if ( !timer() && timers[ i ] === timer ) {
    			timers.splice( i--, 1 );
    		}
    	}

    	if ( !timers.length ) {
    		jQuery.fx.stop();
    	}
    	fxNow = undefined;
    };

    jQuery.fx.timer = function( timer ) {
    	jQuery.timers.push( timer );
    	jQuery.fx.start();
    };

    jQuery.fx.interval = 13;
    jQuery.fx.start = function() {
    	if ( inProgress ) {
    		return;
    	}

    	inProgress = true;
    	schedule();
    };

    jQuery.fx.stop = function() {
    	inProgress = null;
    };

    jQuery.fx.speeds = {
    	slow: 600,
    	fast: 200,

    	// Default speed
    	_default: 400
    };


    // Based off of the plugin by Clint Helfers, with permission.
    // https://web.archive.org/web/20100324014747/http://blindsignals.com/index.php/2009/07/jquery-delay/
    jQuery.fn.delay = function( time, type ) {
    	time = jQuery.fx ? jQuery.fx.speeds[ time ] || time : time;
    	type = type || "fx";

    	return this.queue( type, function( next, hooks ) {
    		var timeout = window.setTimeout( next, time );
    		hooks.stop = function() {
    			window.clearTimeout( timeout );
    		};
    	} );
    };


    ( function() {
    	var input = document.createElement( "input" ),
    		select = document.createElement( "select" ),
    		opt = select.appendChild( document.createElement( "option" ) );

    	input.type = "checkbox";

    	// Support: Android <=4.3 only
    	// Default value for a checkbox should be "on"
    	support.checkOn = input.value !== "";

    	// Support: IE <=11 only
    	// Must access selectedIndex to make default options select
    	support.optSelected = opt.selected;

    	// Support: IE <=11 only
    	// An input loses its value after becoming a radio
    	input = document.createElement( "input" );
    	input.value = "t";
    	input.type = "radio";
    	support.radioValue = input.value === "t";
    } )();


    var boolHook,
    	attrHandle = jQuery.expr.attrHandle;

    jQuery.fn.extend( {
    	attr: function( name, value ) {
    		return access( this, jQuery.attr, name, value, arguments.length > 1 );
    	},

    	removeAttr: function( name ) {
    		return this.each( function() {
    			jQuery.removeAttr( this, name );
    		} );
    	}
    } );

    jQuery.extend( {
    	attr: function( elem, name, value ) {
    		var ret, hooks,
    			nType = elem.nodeType;

    		// Don't get/set attributes on text, comment and attribute nodes
    		if ( nType === 3 || nType === 8 || nType === 2 ) {
    			return;
    		}

    		// Fallback to prop when attributes are not supported
    		if ( typeof elem.getAttribute === "undefined" ) {
    			return jQuery.prop( elem, name, value );
    		}

    		// Attribute hooks are determined by the lowercase version
    		// Grab necessary hook if one is defined
    		if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {
    			hooks = jQuery.attrHooks[ name.toLowerCase() ] ||
    				( jQuery.expr.match.bool.test( name ) ? boolHook : undefined );
    		}

    		if ( value !== undefined ) {
    			if ( value === null ) {
    				jQuery.removeAttr( elem, name );
    				return;
    			}

    			if ( hooks && "set" in hooks &&
    				( ret = hooks.set( elem, value, name ) ) !== undefined ) {
    				return ret;
    			}

    			elem.setAttribute( name, value + "" );
    			return value;
    		}

    		if ( hooks && "get" in hooks && ( ret = hooks.get( elem, name ) ) !== null ) {
    			return ret;
    		}

    		ret = jQuery.find.attr( elem, name );

    		// Non-existent attributes return null, we normalize to undefined
    		return ret == null ? undefined : ret;
    	},

    	attrHooks: {
    		type: {
    			set: function( elem, value ) {
    				if ( !support.radioValue && value === "radio" &&
    					nodeName( elem, "input" ) ) {
    					var val = elem.value;
    					elem.setAttribute( "type", value );
    					if ( val ) {
    						elem.value = val;
    					}
    					return value;
    				}
    			}
    		}
    	},

    	removeAttr: function( elem, value ) {
    		var name,
    			i = 0,

    			// Attribute names can contain non-HTML whitespace characters
    			// https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
    			attrNames = value && value.match( rnothtmlwhite );

    		if ( attrNames && elem.nodeType === 1 ) {
    			while ( ( name = attrNames[ i++ ] ) ) {
    				elem.removeAttribute( name );
    			}
    		}
    	}
    } );

    // Hooks for boolean attributes
    boolHook = {
    	set: function( elem, value, name ) {
    		if ( value === false ) {

    			// Remove boolean attributes when set to false
    			jQuery.removeAttr( elem, name );
    		} else {
    			elem.setAttribute( name, name );
    		}
    		return name;
    	}
    };

    jQuery.each( jQuery.expr.match.bool.source.match( /\w+/g ), function( _i, name ) {
    	var getter = attrHandle[ name ] || jQuery.find.attr;

    	attrHandle[ name ] = function( elem, name, isXML ) {
    		var ret, handle,
    			lowercaseName = name.toLowerCase();

    		if ( !isXML ) {

    			// Avoid an infinite loop by temporarily removing this function from the getter
    			handle = attrHandle[ lowercaseName ];
    			attrHandle[ lowercaseName ] = ret;
    			ret = getter( elem, name, isXML ) != null ?
    				lowercaseName :
    				null;
    			attrHandle[ lowercaseName ] = handle;
    		}
    		return ret;
    	};
    } );




    var rfocusable = /^(?:input|select|textarea|button)$/i,
    	rclickable = /^(?:a|area)$/i;

    jQuery.fn.extend( {
    	prop: function( name, value ) {
    		return access( this, jQuery.prop, name, value, arguments.length > 1 );
    	},

    	removeProp: function( name ) {
    		return this.each( function() {
    			delete this[ jQuery.propFix[ name ] || name ];
    		} );
    	}
    } );

    jQuery.extend( {
    	prop: function( elem, name, value ) {
    		var ret, hooks,
    			nType = elem.nodeType;

    		// Don't get/set properties on text, comment and attribute nodes
    		if ( nType === 3 || nType === 8 || nType === 2 ) {
    			return;
    		}

    		if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {

    			// Fix name and attach hooks
    			name = jQuery.propFix[ name ] || name;
    			hooks = jQuery.propHooks[ name ];
    		}

    		if ( value !== undefined ) {
    			if ( hooks && "set" in hooks &&
    				( ret = hooks.set( elem, value, name ) ) !== undefined ) {
    				return ret;
    			}

    			return ( elem[ name ] = value );
    		}

    		if ( hooks && "get" in hooks && ( ret = hooks.get( elem, name ) ) !== null ) {
    			return ret;
    		}

    		return elem[ name ];
    	},

    	propHooks: {
    		tabIndex: {
    			get: function( elem ) {

    				// Support: IE <=9 - 11 only
    				// elem.tabIndex doesn't always return the
    				// correct value when it hasn't been explicitly set
    				// https://web.archive.org/web/20141116233347/http://fluidproject.org/blog/2008/01/09/getting-setting-and-removing-tabindex-values-with-javascript/
    				// Use proper attribute retrieval(#12072)
    				var tabindex = jQuery.find.attr( elem, "tabindex" );

    				if ( tabindex ) {
    					return parseInt( tabindex, 10 );
    				}

    				if (
    					rfocusable.test( elem.nodeName ) ||
    					rclickable.test( elem.nodeName ) &&
    					elem.href
    				) {
    					return 0;
    				}

    				return -1;
    			}
    		}
    	},

    	propFix: {
    		"for": "htmlFor",
    		"class": "className"
    	}
    } );

    // Support: IE <=11 only
    // Accessing the selectedIndex property
    // forces the browser to respect setting selected
    // on the option
    // The getter ensures a default option is selected
    // when in an optgroup
    // eslint rule "no-unused-expressions" is disabled for this code
    // since it considers such accessions noop
    if ( !support.optSelected ) {
    	jQuery.propHooks.selected = {
    		get: function( elem ) {

    			/* eslint no-unused-expressions: "off" */

    			var parent = elem.parentNode;
    			if ( parent && parent.parentNode ) {
    				parent.parentNode.selectedIndex;
    			}
    			return null;
    		},
    		set: function( elem ) {

    			/* eslint no-unused-expressions: "off" */

    			var parent = elem.parentNode;
    			if ( parent ) {
    				parent.selectedIndex;

    				if ( parent.parentNode ) {
    					parent.parentNode.selectedIndex;
    				}
    			}
    		}
    	};
    }

    jQuery.each( [
    	"tabIndex",
    	"readOnly",
    	"maxLength",
    	"cellSpacing",
    	"cellPadding",
    	"rowSpan",
    	"colSpan",
    	"useMap",
    	"frameBorder",
    	"contentEditable"
    ], function() {
    	jQuery.propFix[ this.toLowerCase() ] = this;
    } );




    	// Strip and collapse whitespace according to HTML spec
    	// https://infra.spec.whatwg.org/#strip-and-collapse-ascii-whitespace
    	function stripAndCollapse( value ) {
    		var tokens = value.match( rnothtmlwhite ) || [];
    		return tokens.join( " " );
    	}


    function getClass( elem ) {
    	return elem.getAttribute && elem.getAttribute( "class" ) || "";
    }

    function classesToArray( value ) {
    	if ( Array.isArray( value ) ) {
    		return value;
    	}
    	if ( typeof value === "string" ) {
    		return value.match( rnothtmlwhite ) || [];
    	}
    	return [];
    }

    jQuery.fn.extend( {
    	addClass: function( value ) {
    		var classes, elem, cur, curValue, clazz, j, finalValue,
    			i = 0;

    		if ( isFunction( value ) ) {
    			return this.each( function( j ) {
    				jQuery( this ).addClass( value.call( this, j, getClass( this ) ) );
    			} );
    		}

    		classes = classesToArray( value );

    		if ( classes.length ) {
    			while ( ( elem = this[ i++ ] ) ) {
    				curValue = getClass( elem );
    				cur = elem.nodeType === 1 && ( " " + stripAndCollapse( curValue ) + " " );

    				if ( cur ) {
    					j = 0;
    					while ( ( clazz = classes[ j++ ] ) ) {
    						if ( cur.indexOf( " " + clazz + " " ) < 0 ) {
    							cur += clazz + " ";
    						}
    					}

    					// Only assign if different to avoid unneeded rendering.
    					finalValue = stripAndCollapse( cur );
    					if ( curValue !== finalValue ) {
    						elem.setAttribute( "class", finalValue );
    					}
    				}
    			}
    		}

    		return this;
    	},

    	removeClass: function( value ) {
    		var classes, elem, cur, curValue, clazz, j, finalValue,
    			i = 0;

    		if ( isFunction( value ) ) {
    			return this.each( function( j ) {
    				jQuery( this ).removeClass( value.call( this, j, getClass( this ) ) );
    			} );
    		}

    		if ( !arguments.length ) {
    			return this.attr( "class", "" );
    		}

    		classes = classesToArray( value );

    		if ( classes.length ) {
    			while ( ( elem = this[ i++ ] ) ) {
    				curValue = getClass( elem );

    				// This expression is here for better compressibility (see addClass)
    				cur = elem.nodeType === 1 && ( " " + stripAndCollapse( curValue ) + " " );

    				if ( cur ) {
    					j = 0;
    					while ( ( clazz = classes[ j++ ] ) ) {

    						// Remove *all* instances
    						while ( cur.indexOf( " " + clazz + " " ) > -1 ) {
    							cur = cur.replace( " " + clazz + " ", " " );
    						}
    					}

    					// Only assign if different to avoid unneeded rendering.
    					finalValue = stripAndCollapse( cur );
    					if ( curValue !== finalValue ) {
    						elem.setAttribute( "class", finalValue );
    					}
    				}
    			}
    		}

    		return this;
    	},

    	toggleClass: function( value, stateVal ) {
    		var type = typeof value,
    			isValidValue = type === "string" || Array.isArray( value );

    		if ( typeof stateVal === "boolean" && isValidValue ) {
    			return stateVal ? this.addClass( value ) : this.removeClass( value );
    		}

    		if ( isFunction( value ) ) {
    			return this.each( function( i ) {
    				jQuery( this ).toggleClass(
    					value.call( this, i, getClass( this ), stateVal ),
    					stateVal
    				);
    			} );
    		}

    		return this.each( function() {
    			var className, i, self, classNames;

    			if ( isValidValue ) {

    				// Toggle individual class names
    				i = 0;
    				self = jQuery( this );
    				classNames = classesToArray( value );

    				while ( ( className = classNames[ i++ ] ) ) {

    					// Check each className given, space separated list
    					if ( self.hasClass( className ) ) {
    						self.removeClass( className );
    					} else {
    						self.addClass( className );
    					}
    				}

    			// Toggle whole class name
    			} else if ( value === undefined || type === "boolean" ) {
    				className = getClass( this );
    				if ( className ) {

    					// Store className if set
    					dataPriv.set( this, "__className__", className );
    				}

    				// If the element has a class name or if we're passed `false`,
    				// then remove the whole classname (if there was one, the above saved it).
    				// Otherwise bring back whatever was previously saved (if anything),
    				// falling back to the empty string if nothing was stored.
    				if ( this.setAttribute ) {
    					this.setAttribute( "class",
    						className || value === false ?
    							"" :
    							dataPriv.get( this, "__className__" ) || ""
    					);
    				}
    			}
    		} );
    	},

    	hasClass: function( selector ) {
    		var className, elem,
    			i = 0;

    		className = " " + selector + " ";
    		while ( ( elem = this[ i++ ] ) ) {
    			if ( elem.nodeType === 1 &&
    				( " " + stripAndCollapse( getClass( elem ) ) + " " ).indexOf( className ) > -1 ) {
    				return true;
    			}
    		}

    		return false;
    	}
    } );




    var rreturn = /\r/g;

    jQuery.fn.extend( {
    	val: function( value ) {
    		var hooks, ret, valueIsFunction,
    			elem = this[ 0 ];

    		if ( !arguments.length ) {
    			if ( elem ) {
    				hooks = jQuery.valHooks[ elem.type ] ||
    					jQuery.valHooks[ elem.nodeName.toLowerCase() ];

    				if ( hooks &&
    					"get" in hooks &&
    					( ret = hooks.get( elem, "value" ) ) !== undefined
    				) {
    					return ret;
    				}

    				ret = elem.value;

    				// Handle most common string cases
    				if ( typeof ret === "string" ) {
    					return ret.replace( rreturn, "" );
    				}

    				// Handle cases where value is null/undef or number
    				return ret == null ? "" : ret;
    			}

    			return;
    		}

    		valueIsFunction = isFunction( value );

    		return this.each( function( i ) {
    			var val;

    			if ( this.nodeType !== 1 ) {
    				return;
    			}

    			if ( valueIsFunction ) {
    				val = value.call( this, i, jQuery( this ).val() );
    			} else {
    				val = value;
    			}

    			// Treat null/undefined as ""; convert numbers to string
    			if ( val == null ) {
    				val = "";

    			} else if ( typeof val === "number" ) {
    				val += "";

    			} else if ( Array.isArray( val ) ) {
    				val = jQuery.map( val, function( value ) {
    					return value == null ? "" : value + "";
    				} );
    			}

    			hooks = jQuery.valHooks[ this.type ] || jQuery.valHooks[ this.nodeName.toLowerCase() ];

    			// If set returns undefined, fall back to normal setting
    			if ( !hooks || !( "set" in hooks ) || hooks.set( this, val, "value" ) === undefined ) {
    				this.value = val;
    			}
    		} );
    	}
    } );

    jQuery.extend( {
    	valHooks: {
    		option: {
    			get: function( elem ) {

    				var val = jQuery.find.attr( elem, "value" );
    				return val != null ?
    					val :

    					// Support: IE <=10 - 11 only
    					// option.text throws exceptions (#14686, #14858)
    					// Strip and collapse whitespace
    					// https://html.spec.whatwg.org/#strip-and-collapse-whitespace
    					stripAndCollapse( jQuery.text( elem ) );
    			}
    		},
    		select: {
    			get: function( elem ) {
    				var value, option, i,
    					options = elem.options,
    					index = elem.selectedIndex,
    					one = elem.type === "select-one",
    					values = one ? null : [],
    					max = one ? index + 1 : options.length;

    				if ( index < 0 ) {
    					i = max;

    				} else {
    					i = one ? index : 0;
    				}

    				// Loop through all the selected options
    				for ( ; i < max; i++ ) {
    					option = options[ i ];

    					// Support: IE <=9 only
    					// IE8-9 doesn't update selected after form reset (#2551)
    					if ( ( option.selected || i === index ) &&

    							// Don't return options that are disabled or in a disabled optgroup
    							!option.disabled &&
    							( !option.parentNode.disabled ||
    								!nodeName( option.parentNode, "optgroup" ) ) ) {

    						// Get the specific value for the option
    						value = jQuery( option ).val();

    						// We don't need an array for one selects
    						if ( one ) {
    							return value;
    						}

    						// Multi-Selects return an array
    						values.push( value );
    					}
    				}

    				return values;
    			},

    			set: function( elem, value ) {
    				var optionSet, option,
    					options = elem.options,
    					values = jQuery.makeArray( value ),
    					i = options.length;

    				while ( i-- ) {
    					option = options[ i ];

    					/* eslint-disable no-cond-assign */

    					if ( option.selected =
    						jQuery.inArray( jQuery.valHooks.option.get( option ), values ) > -1
    					) {
    						optionSet = true;
    					}

    					/* eslint-enable no-cond-assign */
    				}

    				// Force browsers to behave consistently when non-matching value is set
    				if ( !optionSet ) {
    					elem.selectedIndex = -1;
    				}
    				return values;
    			}
    		}
    	}
    } );

    // Radios and checkboxes getter/setter
    jQuery.each( [ "radio", "checkbox" ], function() {
    	jQuery.valHooks[ this ] = {
    		set: function( elem, value ) {
    			if ( Array.isArray( value ) ) {
    				return ( elem.checked = jQuery.inArray( jQuery( elem ).val(), value ) > -1 );
    			}
    		}
    	};
    	if ( !support.checkOn ) {
    		jQuery.valHooks[ this ].get = function( elem ) {
    			return elem.getAttribute( "value" ) === null ? "on" : elem.value;
    		};
    	}
    } );




    // Return jQuery for attributes-only inclusion


    support.focusin = "onfocusin" in window;


    var rfocusMorph = /^(?:focusinfocus|focusoutblur)$/,
    	stopPropagationCallback = function( e ) {
    		e.stopPropagation();
    	};

    jQuery.extend( jQuery.event, {

    	trigger: function( event, data, elem, onlyHandlers ) {

    		var i, cur, tmp, bubbleType, ontype, handle, special, lastElement,
    			eventPath = [ elem || document ],
    			type = hasOwn.call( event, "type" ) ? event.type : event,
    			namespaces = hasOwn.call( event, "namespace" ) ? event.namespace.split( "." ) : [];

    		cur = lastElement = tmp = elem = elem || document;

    		// Don't do events on text and comment nodes
    		if ( elem.nodeType === 3 || elem.nodeType === 8 ) {
    			return;
    		}

    		// focus/blur morphs to focusin/out; ensure we're not firing them right now
    		if ( rfocusMorph.test( type + jQuery.event.triggered ) ) {
    			return;
    		}

    		if ( type.indexOf( "." ) > -1 ) {

    			// Namespaced trigger; create a regexp to match event type in handle()
    			namespaces = type.split( "." );
    			type = namespaces.shift();
    			namespaces.sort();
    		}
    		ontype = type.indexOf( ":" ) < 0 && "on" + type;

    		// Caller can pass in a jQuery.Event object, Object, or just an event type string
    		event = event[ jQuery.expando ] ?
    			event :
    			new jQuery.Event( type, typeof event === "object" && event );

    		// Trigger bitmask: & 1 for native handlers; & 2 for jQuery (always true)
    		event.isTrigger = onlyHandlers ? 2 : 3;
    		event.namespace = namespaces.join( "." );
    		event.rnamespace = event.namespace ?
    			new RegExp( "(^|\\.)" + namespaces.join( "\\.(?:.*\\.|)" ) + "(\\.|$)" ) :
    			null;

    		// Clean up the event in case it is being reused
    		event.result = undefined;
    		if ( !event.target ) {
    			event.target = elem;
    		}

    		// Clone any incoming data and prepend the event, creating the handler arg list
    		data = data == null ?
    			[ event ] :
    			jQuery.makeArray( data, [ event ] );

    		// Allow special events to draw outside the lines
    		special = jQuery.event.special[ type ] || {};
    		if ( !onlyHandlers && special.trigger && special.trigger.apply( elem, data ) === false ) {
    			return;
    		}

    		// Determine event propagation path in advance, per W3C events spec (#9951)
    		// Bubble up to document, then to window; watch for a global ownerDocument var (#9724)
    		if ( !onlyHandlers && !special.noBubble && !isWindow( elem ) ) {

    			bubbleType = special.delegateType || type;
    			if ( !rfocusMorph.test( bubbleType + type ) ) {
    				cur = cur.parentNode;
    			}
    			for ( ; cur; cur = cur.parentNode ) {
    				eventPath.push( cur );
    				tmp = cur;
    			}

    			// Only add window if we got to document (e.g., not plain obj or detached DOM)
    			if ( tmp === ( elem.ownerDocument || document ) ) {
    				eventPath.push( tmp.defaultView || tmp.parentWindow || window );
    			}
    		}

    		// Fire handlers on the event path
    		i = 0;
    		while ( ( cur = eventPath[ i++ ] ) && !event.isPropagationStopped() ) {
    			lastElement = cur;
    			event.type = i > 1 ?
    				bubbleType :
    				special.bindType || type;

    			// jQuery handler
    			handle = ( dataPriv.get( cur, "events" ) || Object.create( null ) )[ event.type ] &&
    				dataPriv.get( cur, "handle" );
    			if ( handle ) {
    				handle.apply( cur, data );
    			}

    			// Native handler
    			handle = ontype && cur[ ontype ];
    			if ( handle && handle.apply && acceptData( cur ) ) {
    				event.result = handle.apply( cur, data );
    				if ( event.result === false ) {
    					event.preventDefault();
    				}
    			}
    		}
    		event.type = type;

    		// If nobody prevented the default action, do it now
    		if ( !onlyHandlers && !event.isDefaultPrevented() ) {

    			if ( ( !special._default ||
    				special._default.apply( eventPath.pop(), data ) === false ) &&
    				acceptData( elem ) ) {

    				// Call a native DOM method on the target with the same name as the event.
    				// Don't do default actions on window, that's where global variables be (#6170)
    				if ( ontype && isFunction( elem[ type ] ) && !isWindow( elem ) ) {

    					// Don't re-trigger an onFOO event when we call its FOO() method
    					tmp = elem[ ontype ];

    					if ( tmp ) {
    						elem[ ontype ] = null;
    					}

    					// Prevent re-triggering of the same event, since we already bubbled it above
    					jQuery.event.triggered = type;

    					if ( event.isPropagationStopped() ) {
    						lastElement.addEventListener( type, stopPropagationCallback );
    					}

    					elem[ type ]();

    					if ( event.isPropagationStopped() ) {
    						lastElement.removeEventListener( type, stopPropagationCallback );
    					}

    					jQuery.event.triggered = undefined;

    					if ( tmp ) {
    						elem[ ontype ] = tmp;
    					}
    				}
    			}
    		}

    		return event.result;
    	},

    	// Piggyback on a donor event to simulate a different one
    	// Used only for `focus(in | out)` events
    	simulate: function( type, elem, event ) {
    		var e = jQuery.extend(
    			new jQuery.Event(),
    			event,
    			{
    				type: type,
    				isSimulated: true
    			}
    		);

    		jQuery.event.trigger( e, null, elem );
    	}

    } );

    jQuery.fn.extend( {

    	trigger: function( type, data ) {
    		return this.each( function() {
    			jQuery.event.trigger( type, data, this );
    		} );
    	},
    	triggerHandler: function( type, data ) {
    		var elem = this[ 0 ];
    		if ( elem ) {
    			return jQuery.event.trigger( type, data, elem, true );
    		}
    	}
    } );


    // Support: Firefox <=44
    // Firefox doesn't have focus(in | out) events
    // Related ticket - https://bugzilla.mozilla.org/show_bug.cgi?id=687787
    //
    // Support: Chrome <=48 - 49, Safari <=9.0 - 9.1
    // focus(in | out) events fire after focus & blur events,
    // which is spec violation - http://www.w3.org/TR/DOM-Level-3-Events/#events-focusevent-event-order
    // Related ticket - https://bugs.chromium.org/p/chromium/issues/detail?id=449857
    if ( !support.focusin ) {
    	jQuery.each( { focus: "focusin", blur: "focusout" }, function( orig, fix ) {

    		// Attach a single capturing handler on the document while someone wants focusin/focusout
    		var handler = function( event ) {
    			jQuery.event.simulate( fix, event.target, jQuery.event.fix( event ) );
    		};

    		jQuery.event.special[ fix ] = {
    			setup: function() {

    				// Handle: regular nodes (via `this.ownerDocument`), window
    				// (via `this.document`) & document (via `this`).
    				var doc = this.ownerDocument || this.document || this,
    					attaches = dataPriv.access( doc, fix );

    				if ( !attaches ) {
    					doc.addEventListener( orig, handler, true );
    				}
    				dataPriv.access( doc, fix, ( attaches || 0 ) + 1 );
    			},
    			teardown: function() {
    				var doc = this.ownerDocument || this.document || this,
    					attaches = dataPriv.access( doc, fix ) - 1;

    				if ( !attaches ) {
    					doc.removeEventListener( orig, handler, true );
    					dataPriv.remove( doc, fix );

    				} else {
    					dataPriv.access( doc, fix, attaches );
    				}
    			}
    		};
    	} );
    }
    var location = window.location;

    var nonce = { guid: Date.now() };

    var rquery = ( /\?/ );



    // Cross-browser xml parsing
    jQuery.parseXML = function( data ) {
    	var xml, parserErrorElem;
    	if ( !data || typeof data !== "string" ) {
    		return null;
    	}

    	// Support: IE 9 - 11 only
    	// IE throws on parseFromString with invalid input.
    	try {
    		xml = ( new window.DOMParser() ).parseFromString( data, "text/xml" );
    	} catch ( e ) {}

    	parserErrorElem = xml && xml.getElementsByTagName( "parsererror" )[ 0 ];
    	if ( !xml || parserErrorElem ) {
    		jQuery.error( "Invalid XML: " + (
    			parserErrorElem ?
    				jQuery.map( parserErrorElem.childNodes, function( el ) {
    					return el.textContent;
    				} ).join( "\n" ) :
    				data
    		) );
    	}
    	return xml;
    };


    var
    	rbracket = /\[\]$/,
    	rCRLF = /\r?\n/g,
    	rsubmitterTypes = /^(?:submit|button|image|reset|file)$/i,
    	rsubmittable = /^(?:input|select|textarea|keygen)/i;

    function buildParams( prefix, obj, traditional, add ) {
    	var name;

    	if ( Array.isArray( obj ) ) {

    		// Serialize array item.
    		jQuery.each( obj, function( i, v ) {
    			if ( traditional || rbracket.test( prefix ) ) {

    				// Treat each array item as a scalar.
    				add( prefix, v );

    			} else {

    				// Item is non-scalar (array or object), encode its numeric index.
    				buildParams(
    					prefix + "[" + ( typeof v === "object" && v != null ? i : "" ) + "]",
    					v,
    					traditional,
    					add
    				);
    			}
    		} );

    	} else if ( !traditional && toType( obj ) === "object" ) {

    		// Serialize object item.
    		for ( name in obj ) {
    			buildParams( prefix + "[" + name + "]", obj[ name ], traditional, add );
    		}

    	} else {

    		// Serialize scalar item.
    		add( prefix, obj );
    	}
    }

    // Serialize an array of form elements or a set of
    // key/values into a query string
    jQuery.param = function( a, traditional ) {
    	var prefix,
    		s = [],
    		add = function( key, valueOrFunction ) {

    			// If value is a function, invoke it and use its return value
    			var value = isFunction( valueOrFunction ) ?
    				valueOrFunction() :
    				valueOrFunction;

    			s[ s.length ] = encodeURIComponent( key ) + "=" +
    				encodeURIComponent( value == null ? "" : value );
    		};

    	if ( a == null ) {
    		return "";
    	}

    	// If an array was passed in, assume that it is an array of form elements.
    	if ( Array.isArray( a ) || ( a.jquery && !jQuery.isPlainObject( a ) ) ) {

    		// Serialize the form elements
    		jQuery.each( a, function() {
    			add( this.name, this.value );
    		} );

    	} else {

    		// If traditional, encode the "old" way (the way 1.3.2 or older
    		// did it), otherwise encode params recursively.
    		for ( prefix in a ) {
    			buildParams( prefix, a[ prefix ], traditional, add );
    		}
    	}

    	// Return the resulting serialization
    	return s.join( "&" );
    };

    jQuery.fn.extend( {
    	serialize: function() {
    		return jQuery.param( this.serializeArray() );
    	},
    	serializeArray: function() {
    		return this.map( function() {

    			// Can add propHook for "elements" to filter or add form elements
    			var elements = jQuery.prop( this, "elements" );
    			return elements ? jQuery.makeArray( elements ) : this;
    		} ).filter( function() {
    			var type = this.type;

    			// Use .is( ":disabled" ) so that fieldset[disabled] works
    			return this.name && !jQuery( this ).is( ":disabled" ) &&
    				rsubmittable.test( this.nodeName ) && !rsubmitterTypes.test( type ) &&
    				( this.checked || !rcheckableType.test( type ) );
    		} ).map( function( _i, elem ) {
    			var val = jQuery( this ).val();

    			if ( val == null ) {
    				return null;
    			}

    			if ( Array.isArray( val ) ) {
    				return jQuery.map( val, function( val ) {
    					return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
    				} );
    			}

    			return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
    		} ).get();
    	}
    } );


    var
    	r20 = /%20/g,
    	rhash = /#.*$/,
    	rantiCache = /([?&])_=[^&]*/,
    	rheaders = /^(.*?):[ \t]*([^\r\n]*)$/mg,

    	// #7653, #8125, #8152: local protocol detection
    	rlocalProtocol = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/,
    	rnoContent = /^(?:GET|HEAD)$/,
    	rprotocol = /^\/\//,

    	/* Prefilters
    	 * 1) They are useful to introduce custom dataTypes (see ajax/jsonp.js for an example)
    	 * 2) These are called:
    	 *    - BEFORE asking for a transport
    	 *    - AFTER param serialization (s.data is a string if s.processData is true)
    	 * 3) key is the dataType
    	 * 4) the catchall symbol "*" can be used
    	 * 5) execution will start with transport dataType and THEN continue down to "*" if needed
    	 */
    	prefilters = {},

    	/* Transports bindings
    	 * 1) key is the dataType
    	 * 2) the catchall symbol "*" can be used
    	 * 3) selection will start with transport dataType and THEN go to "*" if needed
    	 */
    	transports = {},

    	// Avoid comment-prolog char sequence (#10098); must appease lint and evade compression
    	allTypes = "*/".concat( "*" ),

    	// Anchor tag for parsing the document origin
    	originAnchor = document.createElement( "a" );

    originAnchor.href = location.href;

    // Base "constructor" for jQuery.ajaxPrefilter and jQuery.ajaxTransport
    function addToPrefiltersOrTransports( structure ) {

    	// dataTypeExpression is optional and defaults to "*"
    	return function( dataTypeExpression, func ) {

    		if ( typeof dataTypeExpression !== "string" ) {
    			func = dataTypeExpression;
    			dataTypeExpression = "*";
    		}

    		var dataType,
    			i = 0,
    			dataTypes = dataTypeExpression.toLowerCase().match( rnothtmlwhite ) || [];

    		if ( isFunction( func ) ) {

    			// For each dataType in the dataTypeExpression
    			while ( ( dataType = dataTypes[ i++ ] ) ) {

    				// Prepend if requested
    				if ( dataType[ 0 ] === "+" ) {
    					dataType = dataType.slice( 1 ) || "*";
    					( structure[ dataType ] = structure[ dataType ] || [] ).unshift( func );

    				// Otherwise append
    				} else {
    					( structure[ dataType ] = structure[ dataType ] || [] ).push( func );
    				}
    			}
    		}
    	};
    }

    // Base inspection function for prefilters and transports
    function inspectPrefiltersOrTransports( structure, options, originalOptions, jqXHR ) {

    	var inspected = {},
    		seekingTransport = ( structure === transports );

    	function inspect( dataType ) {
    		var selected;
    		inspected[ dataType ] = true;
    		jQuery.each( structure[ dataType ] || [], function( _, prefilterOrFactory ) {
    			var dataTypeOrTransport = prefilterOrFactory( options, originalOptions, jqXHR );
    			if ( typeof dataTypeOrTransport === "string" &&
    				!seekingTransport && !inspected[ dataTypeOrTransport ] ) {

    				options.dataTypes.unshift( dataTypeOrTransport );
    				inspect( dataTypeOrTransport );
    				return false;
    			} else if ( seekingTransport ) {
    				return !( selected = dataTypeOrTransport );
    			}
    		} );
    		return selected;
    	}

    	return inspect( options.dataTypes[ 0 ] ) || !inspected[ "*" ] && inspect( "*" );
    }

    // A special extend for ajax options
    // that takes "flat" options (not to be deep extended)
    // Fixes #9887
    function ajaxExtend( target, src ) {
    	var key, deep,
    		flatOptions = jQuery.ajaxSettings.flatOptions || {};

    	for ( key in src ) {
    		if ( src[ key ] !== undefined ) {
    			( flatOptions[ key ] ? target : ( deep || ( deep = {} ) ) )[ key ] = src[ key ];
    		}
    	}
    	if ( deep ) {
    		jQuery.extend( true, target, deep );
    	}

    	return target;
    }

    /* Handles responses to an ajax request:
     * - finds the right dataType (mediates between content-type and expected dataType)
     * - returns the corresponding response
     */
    function ajaxHandleResponses( s, jqXHR, responses ) {

    	var ct, type, finalDataType, firstDataType,
    		contents = s.contents,
    		dataTypes = s.dataTypes;

    	// Remove auto dataType and get content-type in the process
    	while ( dataTypes[ 0 ] === "*" ) {
    		dataTypes.shift();
    		if ( ct === undefined ) {
    			ct = s.mimeType || jqXHR.getResponseHeader( "Content-Type" );
    		}
    	}

    	// Check if we're dealing with a known content-type
    	if ( ct ) {
    		for ( type in contents ) {
    			if ( contents[ type ] && contents[ type ].test( ct ) ) {
    				dataTypes.unshift( type );
    				break;
    			}
    		}
    	}

    	// Check to see if we have a response for the expected dataType
    	if ( dataTypes[ 0 ] in responses ) {
    		finalDataType = dataTypes[ 0 ];
    	} else {

    		// Try convertible dataTypes
    		for ( type in responses ) {
    			if ( !dataTypes[ 0 ] || s.converters[ type + " " + dataTypes[ 0 ] ] ) {
    				finalDataType = type;
    				break;
    			}
    			if ( !firstDataType ) {
    				firstDataType = type;
    			}
    		}

    		// Or just use first one
    		finalDataType = finalDataType || firstDataType;
    	}

    	// If we found a dataType
    	// We add the dataType to the list if needed
    	// and return the corresponding response
    	if ( finalDataType ) {
    		if ( finalDataType !== dataTypes[ 0 ] ) {
    			dataTypes.unshift( finalDataType );
    		}
    		return responses[ finalDataType ];
    	}
    }

    /* Chain conversions given the request and the original response
     * Also sets the responseXXX fields on the jqXHR instance
     */
    function ajaxConvert( s, response, jqXHR, isSuccess ) {
    	var conv2, current, conv, tmp, prev,
    		converters = {},

    		// Work with a copy of dataTypes in case we need to modify it for conversion
    		dataTypes = s.dataTypes.slice();

    	// Create converters map with lowercased keys
    	if ( dataTypes[ 1 ] ) {
    		for ( conv in s.converters ) {
    			converters[ conv.toLowerCase() ] = s.converters[ conv ];
    		}
    	}

    	current = dataTypes.shift();

    	// Convert to each sequential dataType
    	while ( current ) {

    		if ( s.responseFields[ current ] ) {
    			jqXHR[ s.responseFields[ current ] ] = response;
    		}

    		// Apply the dataFilter if provided
    		if ( !prev && isSuccess && s.dataFilter ) {
    			response = s.dataFilter( response, s.dataType );
    		}

    		prev = current;
    		current = dataTypes.shift();

    		if ( current ) {

    			// There's only work to do if current dataType is non-auto
    			if ( current === "*" ) {

    				current = prev;

    			// Convert response if prev dataType is non-auto and differs from current
    			} else if ( prev !== "*" && prev !== current ) {

    				// Seek a direct converter
    				conv = converters[ prev + " " + current ] || converters[ "* " + current ];

    				// If none found, seek a pair
    				if ( !conv ) {
    					for ( conv2 in converters ) {

    						// If conv2 outputs current
    						tmp = conv2.split( " " );
    						if ( tmp[ 1 ] === current ) {

    							// If prev can be converted to accepted input
    							conv = converters[ prev + " " + tmp[ 0 ] ] ||
    								converters[ "* " + tmp[ 0 ] ];
    							if ( conv ) {

    								// Condense equivalence converters
    								if ( conv === true ) {
    									conv = converters[ conv2 ];

    								// Otherwise, insert the intermediate dataType
    								} else if ( converters[ conv2 ] !== true ) {
    									current = tmp[ 0 ];
    									dataTypes.unshift( tmp[ 1 ] );
    								}
    								break;
    							}
    						}
    					}
    				}

    				// Apply converter (if not an equivalence)
    				if ( conv !== true ) {

    					// Unless errors are allowed to bubble, catch and return them
    					if ( conv && s.throws ) {
    						response = conv( response );
    					} else {
    						try {
    							response = conv( response );
    						} catch ( e ) {
    							return {
    								state: "parsererror",
    								error: conv ? e : "No conversion from " + prev + " to " + current
    							};
    						}
    					}
    				}
    			}
    		}
    	}

    	return { state: "success", data: response };
    }

    jQuery.extend( {

    	// Counter for holding the number of active queries
    	active: 0,

    	// Last-Modified header cache for next request
    	lastModified: {},
    	etag: {},

    	ajaxSettings: {
    		url: location.href,
    		type: "GET",
    		isLocal: rlocalProtocol.test( location.protocol ),
    		global: true,
    		processData: true,
    		async: true,
    		contentType: "application/x-www-form-urlencoded; charset=UTF-8",

    		/*
    		timeout: 0,
    		data: null,
    		dataType: null,
    		username: null,
    		password: null,
    		cache: null,
    		throws: false,
    		traditional: false,
    		headers: {},
    		*/

    		accepts: {
    			"*": allTypes,
    			text: "text/plain",
    			html: "text/html",
    			xml: "application/xml, text/xml",
    			json: "application/json, text/javascript"
    		},

    		contents: {
    			xml: /\bxml\b/,
    			html: /\bhtml/,
    			json: /\bjson\b/
    		},

    		responseFields: {
    			xml: "responseXML",
    			text: "responseText",
    			json: "responseJSON"
    		},

    		// Data converters
    		// Keys separate source (or catchall "*") and destination types with a single space
    		converters: {

    			// Convert anything to text
    			"* text": String,

    			// Text to html (true = no transformation)
    			"text html": true,

    			// Evaluate text as a json expression
    			"text json": JSON.parse,

    			// Parse text as xml
    			"text xml": jQuery.parseXML
    		},

    		// For options that shouldn't be deep extended:
    		// you can add your own custom options here if
    		// and when you create one that shouldn't be
    		// deep extended (see ajaxExtend)
    		flatOptions: {
    			url: true,
    			context: true
    		}
    	},

    	// Creates a full fledged settings object into target
    	// with both ajaxSettings and settings fields.
    	// If target is omitted, writes into ajaxSettings.
    	ajaxSetup: function( target, settings ) {
    		return settings ?

    			// Building a settings object
    			ajaxExtend( ajaxExtend( target, jQuery.ajaxSettings ), settings ) :

    			// Extending ajaxSettings
    			ajaxExtend( jQuery.ajaxSettings, target );
    	},

    	ajaxPrefilter: addToPrefiltersOrTransports( prefilters ),
    	ajaxTransport: addToPrefiltersOrTransports( transports ),

    	// Main method
    	ajax: function( url, options ) {

    		// If url is an object, simulate pre-1.5 signature
    		if ( typeof url === "object" ) {
    			options = url;
    			url = undefined;
    		}

    		// Force options to be an object
    		options = options || {};

    		var transport,

    			// URL without anti-cache param
    			cacheURL,

    			// Response headers
    			responseHeadersString,
    			responseHeaders,

    			// timeout handle
    			timeoutTimer,

    			// Url cleanup var
    			urlAnchor,

    			// Request state (becomes false upon send and true upon completion)
    			completed,

    			// To know if global events are to be dispatched
    			fireGlobals,

    			// Loop variable
    			i,

    			// uncached part of the url
    			uncached,

    			// Create the final options object
    			s = jQuery.ajaxSetup( {}, options ),

    			// Callbacks context
    			callbackContext = s.context || s,

    			// Context for global events is callbackContext if it is a DOM node or jQuery collection
    			globalEventContext = s.context &&
    				( callbackContext.nodeType || callbackContext.jquery ) ?
    				jQuery( callbackContext ) :
    				jQuery.event,

    			// Deferreds
    			deferred = jQuery.Deferred(),
    			completeDeferred = jQuery.Callbacks( "once memory" ),

    			// Status-dependent callbacks
    			statusCode = s.statusCode || {},

    			// Headers (they are sent all at once)
    			requestHeaders = {},
    			requestHeadersNames = {},

    			// Default abort message
    			strAbort = "canceled",

    			// Fake xhr
    			jqXHR = {
    				readyState: 0,

    				// Builds headers hashtable if needed
    				getResponseHeader: function( key ) {
    					var match;
    					if ( completed ) {
    						if ( !responseHeaders ) {
    							responseHeaders = {};
    							while ( ( match = rheaders.exec( responseHeadersString ) ) ) {
    								responseHeaders[ match[ 1 ].toLowerCase() + " " ] =
    									( responseHeaders[ match[ 1 ].toLowerCase() + " " ] || [] )
    										.concat( match[ 2 ] );
    							}
    						}
    						match = responseHeaders[ key.toLowerCase() + " " ];
    					}
    					return match == null ? null : match.join( ", " );
    				},

    				// Raw string
    				getAllResponseHeaders: function() {
    					return completed ? responseHeadersString : null;
    				},

    				// Caches the header
    				setRequestHeader: function( name, value ) {
    					if ( completed == null ) {
    						name = requestHeadersNames[ name.toLowerCase() ] =
    							requestHeadersNames[ name.toLowerCase() ] || name;
    						requestHeaders[ name ] = value;
    					}
    					return this;
    				},

    				// Overrides response content-type header
    				overrideMimeType: function( type ) {
    					if ( completed == null ) {
    						s.mimeType = type;
    					}
    					return this;
    				},

    				// Status-dependent callbacks
    				statusCode: function( map ) {
    					var code;
    					if ( map ) {
    						if ( completed ) {

    							// Execute the appropriate callbacks
    							jqXHR.always( map[ jqXHR.status ] );
    						} else {

    							// Lazy-add the new callbacks in a way that preserves old ones
    							for ( code in map ) {
    								statusCode[ code ] = [ statusCode[ code ], map[ code ] ];
    							}
    						}
    					}
    					return this;
    				},

    				// Cancel the request
    				abort: function( statusText ) {
    					var finalText = statusText || strAbort;
    					if ( transport ) {
    						transport.abort( finalText );
    					}
    					done( 0, finalText );
    					return this;
    				}
    			};

    		// Attach deferreds
    		deferred.promise( jqXHR );

    		// Add protocol if not provided (prefilters might expect it)
    		// Handle falsy url in the settings object (#10093: consistency with old signature)
    		// We also use the url parameter if available
    		s.url = ( ( url || s.url || location.href ) + "" )
    			.replace( rprotocol, location.protocol + "//" );

    		// Alias method option to type as per ticket #12004
    		s.type = options.method || options.type || s.method || s.type;

    		// Extract dataTypes list
    		s.dataTypes = ( s.dataType || "*" ).toLowerCase().match( rnothtmlwhite ) || [ "" ];

    		// A cross-domain request is in order when the origin doesn't match the current origin.
    		if ( s.crossDomain == null ) {
    			urlAnchor = document.createElement( "a" );

    			// Support: IE <=8 - 11, Edge 12 - 15
    			// IE throws exception on accessing the href property if url is malformed,
    			// e.g. http://example.com:80x/
    			try {
    				urlAnchor.href = s.url;

    				// Support: IE <=8 - 11 only
    				// Anchor's host property isn't correctly set when s.url is relative
    				urlAnchor.href = urlAnchor.href;
    				s.crossDomain = originAnchor.protocol + "//" + originAnchor.host !==
    					urlAnchor.protocol + "//" + urlAnchor.host;
    			} catch ( e ) {

    				// If there is an error parsing the URL, assume it is crossDomain,
    				// it can be rejected by the transport if it is invalid
    				s.crossDomain = true;
    			}
    		}

    		// Convert data if not already a string
    		if ( s.data && s.processData && typeof s.data !== "string" ) {
    			s.data = jQuery.param( s.data, s.traditional );
    		}

    		// Apply prefilters
    		inspectPrefiltersOrTransports( prefilters, s, options, jqXHR );

    		// If request was aborted inside a prefilter, stop there
    		if ( completed ) {
    			return jqXHR;
    		}

    		// We can fire global events as of now if asked to
    		// Don't fire events if jQuery.event is undefined in an AMD-usage scenario (#15118)
    		fireGlobals = jQuery.event && s.global;

    		// Watch for a new set of requests
    		if ( fireGlobals && jQuery.active++ === 0 ) {
    			jQuery.event.trigger( "ajaxStart" );
    		}

    		// Uppercase the type
    		s.type = s.type.toUpperCase();

    		// Determine if request has content
    		s.hasContent = !rnoContent.test( s.type );

    		// Save the URL in case we're toying with the If-Modified-Since
    		// and/or If-None-Match header later on
    		// Remove hash to simplify url manipulation
    		cacheURL = s.url.replace( rhash, "" );

    		// More options handling for requests with no content
    		if ( !s.hasContent ) {

    			// Remember the hash so we can put it back
    			uncached = s.url.slice( cacheURL.length );

    			// If data is available and should be processed, append data to url
    			if ( s.data && ( s.processData || typeof s.data === "string" ) ) {
    				cacheURL += ( rquery.test( cacheURL ) ? "&" : "?" ) + s.data;

    				// #9682: remove data so that it's not used in an eventual retry
    				delete s.data;
    			}

    			// Add or update anti-cache param if needed
    			if ( s.cache === false ) {
    				cacheURL = cacheURL.replace( rantiCache, "$1" );
    				uncached = ( rquery.test( cacheURL ) ? "&" : "?" ) + "_=" + ( nonce.guid++ ) +
    					uncached;
    			}

    			// Put hash and anti-cache on the URL that will be requested (gh-1732)
    			s.url = cacheURL + uncached;

    		// Change '%20' to '+' if this is encoded form body content (gh-2658)
    		} else if ( s.data && s.processData &&
    			( s.contentType || "" ).indexOf( "application/x-www-form-urlencoded" ) === 0 ) {
    			s.data = s.data.replace( r20, "+" );
    		}

    		// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
    		if ( s.ifModified ) {
    			if ( jQuery.lastModified[ cacheURL ] ) {
    				jqXHR.setRequestHeader( "If-Modified-Since", jQuery.lastModified[ cacheURL ] );
    			}
    			if ( jQuery.etag[ cacheURL ] ) {
    				jqXHR.setRequestHeader( "If-None-Match", jQuery.etag[ cacheURL ] );
    			}
    		}

    		// Set the correct header, if data is being sent
    		if ( s.data && s.hasContent && s.contentType !== false || options.contentType ) {
    			jqXHR.setRequestHeader( "Content-Type", s.contentType );
    		}

    		// Set the Accepts header for the server, depending on the dataType
    		jqXHR.setRequestHeader(
    			"Accept",
    			s.dataTypes[ 0 ] && s.accepts[ s.dataTypes[ 0 ] ] ?
    				s.accepts[ s.dataTypes[ 0 ] ] +
    					( s.dataTypes[ 0 ] !== "*" ? ", " + allTypes + "; q=0.01" : "" ) :
    				s.accepts[ "*" ]
    		);

    		// Check for headers option
    		for ( i in s.headers ) {
    			jqXHR.setRequestHeader( i, s.headers[ i ] );
    		}

    		// Allow custom headers/mimetypes and early abort
    		if ( s.beforeSend &&
    			( s.beforeSend.call( callbackContext, jqXHR, s ) === false || completed ) ) {

    			// Abort if not done already and return
    			return jqXHR.abort();
    		}

    		// Aborting is no longer a cancellation
    		strAbort = "abort";

    		// Install callbacks on deferreds
    		completeDeferred.add( s.complete );
    		jqXHR.done( s.success );
    		jqXHR.fail( s.error );

    		// Get transport
    		transport = inspectPrefiltersOrTransports( transports, s, options, jqXHR );

    		// If no transport, we auto-abort
    		if ( !transport ) {
    			done( -1, "No Transport" );
    		} else {
    			jqXHR.readyState = 1;

    			// Send global event
    			if ( fireGlobals ) {
    				globalEventContext.trigger( "ajaxSend", [ jqXHR, s ] );
    			}

    			// If request was aborted inside ajaxSend, stop there
    			if ( completed ) {
    				return jqXHR;
    			}

    			// Timeout
    			if ( s.async && s.timeout > 0 ) {
    				timeoutTimer = window.setTimeout( function() {
    					jqXHR.abort( "timeout" );
    				}, s.timeout );
    			}

    			try {
    				completed = false;
    				transport.send( requestHeaders, done );
    			} catch ( e ) {

    				// Rethrow post-completion exceptions
    				if ( completed ) {
    					throw e;
    				}

    				// Propagate others as results
    				done( -1, e );
    			}
    		}

    		// Callback for when everything is done
    		function done( status, nativeStatusText, responses, headers ) {
    			var isSuccess, success, error, response, modified,
    				statusText = nativeStatusText;

    			// Ignore repeat invocations
    			if ( completed ) {
    				return;
    			}

    			completed = true;

    			// Clear timeout if it exists
    			if ( timeoutTimer ) {
    				window.clearTimeout( timeoutTimer );
    			}

    			// Dereference transport for early garbage collection
    			// (no matter how long the jqXHR object will be used)
    			transport = undefined;

    			// Cache response headers
    			responseHeadersString = headers || "";

    			// Set readyState
    			jqXHR.readyState = status > 0 ? 4 : 0;

    			// Determine if successful
    			isSuccess = status >= 200 && status < 300 || status === 304;

    			// Get response data
    			if ( responses ) {
    				response = ajaxHandleResponses( s, jqXHR, responses );
    			}

    			// Use a noop converter for missing script but not if jsonp
    			if ( !isSuccess &&
    				jQuery.inArray( "script", s.dataTypes ) > -1 &&
    				jQuery.inArray( "json", s.dataTypes ) < 0 ) {
    				s.converters[ "text script" ] = function() {};
    			}

    			// Convert no matter what (that way responseXXX fields are always set)
    			response = ajaxConvert( s, response, jqXHR, isSuccess );

    			// If successful, handle type chaining
    			if ( isSuccess ) {

    				// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
    				if ( s.ifModified ) {
    					modified = jqXHR.getResponseHeader( "Last-Modified" );
    					if ( modified ) {
    						jQuery.lastModified[ cacheURL ] = modified;
    					}
    					modified = jqXHR.getResponseHeader( "etag" );
    					if ( modified ) {
    						jQuery.etag[ cacheURL ] = modified;
    					}
    				}

    				// if no content
    				if ( status === 204 || s.type === "HEAD" ) {
    					statusText = "nocontent";

    				// if not modified
    				} else if ( status === 304 ) {
    					statusText = "notmodified";

    				// If we have data, let's convert it
    				} else {
    					statusText = response.state;
    					success = response.data;
    					error = response.error;
    					isSuccess = !error;
    				}
    			} else {

    				// Extract error from statusText and normalize for non-aborts
    				error = statusText;
    				if ( status || !statusText ) {
    					statusText = "error";
    					if ( status < 0 ) {
    						status = 0;
    					}
    				}
    			}

    			// Set data for the fake xhr object
    			jqXHR.status = status;
    			jqXHR.statusText = ( nativeStatusText || statusText ) + "";

    			// Success/Error
    			if ( isSuccess ) {
    				deferred.resolveWith( callbackContext, [ success, statusText, jqXHR ] );
    			} else {
    				deferred.rejectWith( callbackContext, [ jqXHR, statusText, error ] );
    			}

    			// Status-dependent callbacks
    			jqXHR.statusCode( statusCode );
    			statusCode = undefined;

    			if ( fireGlobals ) {
    				globalEventContext.trigger( isSuccess ? "ajaxSuccess" : "ajaxError",
    					[ jqXHR, s, isSuccess ? success : error ] );
    			}

    			// Complete
    			completeDeferred.fireWith( callbackContext, [ jqXHR, statusText ] );

    			if ( fireGlobals ) {
    				globalEventContext.trigger( "ajaxComplete", [ jqXHR, s ] );

    				// Handle the global AJAX counter
    				if ( !( --jQuery.active ) ) {
    					jQuery.event.trigger( "ajaxStop" );
    				}
    			}
    		}

    		return jqXHR;
    	},

    	getJSON: function( url, data, callback ) {
    		return jQuery.get( url, data, callback, "json" );
    	},

    	getScript: function( url, callback ) {
    		return jQuery.get( url, undefined, callback, "script" );
    	}
    } );

    jQuery.each( [ "get", "post" ], function( _i, method ) {
    	jQuery[ method ] = function( url, data, callback, type ) {

    		// Shift arguments if data argument was omitted
    		if ( isFunction( data ) ) {
    			type = type || callback;
    			callback = data;
    			data = undefined;
    		}

    		// The url can be an options object (which then must have .url)
    		return jQuery.ajax( jQuery.extend( {
    			url: url,
    			type: method,
    			dataType: type,
    			data: data,
    			success: callback
    		}, jQuery.isPlainObject( url ) && url ) );
    	};
    } );

    jQuery.ajaxPrefilter( function( s ) {
    	var i;
    	for ( i in s.headers ) {
    		if ( i.toLowerCase() === "content-type" ) {
    			s.contentType = s.headers[ i ] || "";
    		}
    	}
    } );


    jQuery._evalUrl = function( url, options, doc ) {
    	return jQuery.ajax( {
    		url: url,

    		// Make this explicit, since user can override this through ajaxSetup (#11264)
    		type: "GET",
    		dataType: "script",
    		cache: true,
    		async: false,
    		global: false,

    		// Only evaluate the response if it is successful (gh-4126)
    		// dataFilter is not invoked for failure responses, so using it instead
    		// of the default converter is kludgy but it works.
    		converters: {
    			"text script": function() {}
    		},
    		dataFilter: function( response ) {
    			jQuery.globalEval( response, options, doc );
    		}
    	} );
    };


    jQuery.fn.extend( {
    	wrapAll: function( html ) {
    		var wrap;

    		if ( this[ 0 ] ) {
    			if ( isFunction( html ) ) {
    				html = html.call( this[ 0 ] );
    			}

    			// The elements to wrap the target around
    			wrap = jQuery( html, this[ 0 ].ownerDocument ).eq( 0 ).clone( true );

    			if ( this[ 0 ].parentNode ) {
    				wrap.insertBefore( this[ 0 ] );
    			}

    			wrap.map( function() {
    				var elem = this;

    				while ( elem.firstElementChild ) {
    					elem = elem.firstElementChild;
    				}

    				return elem;
    			} ).append( this );
    		}

    		return this;
    	},

    	wrapInner: function( html ) {
    		if ( isFunction( html ) ) {
    			return this.each( function( i ) {
    				jQuery( this ).wrapInner( html.call( this, i ) );
    			} );
    		}

    		return this.each( function() {
    			var self = jQuery( this ),
    				contents = self.contents();

    			if ( contents.length ) {
    				contents.wrapAll( html );

    			} else {
    				self.append( html );
    			}
    		} );
    	},

    	wrap: function( html ) {
    		var htmlIsFunction = isFunction( html );

    		return this.each( function( i ) {
    			jQuery( this ).wrapAll( htmlIsFunction ? html.call( this, i ) : html );
    		} );
    	},

    	unwrap: function( selector ) {
    		this.parent( selector ).not( "body" ).each( function() {
    			jQuery( this ).replaceWith( this.childNodes );
    		} );
    		return this;
    	}
    } );


    jQuery.expr.pseudos.hidden = function( elem ) {
    	return !jQuery.expr.pseudos.visible( elem );
    };
    jQuery.expr.pseudos.visible = function( elem ) {
    	return !!( elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length );
    };




    jQuery.ajaxSettings.xhr = function() {
    	try {
    		return new window.XMLHttpRequest();
    	} catch ( e ) {}
    };

    var xhrSuccessStatus = {

    		// File protocol always yields status code 0, assume 200
    		0: 200,

    		// Support: IE <=9 only
    		// #1450: sometimes IE returns 1223 when it should be 204
    		1223: 204
    	},
    	xhrSupported = jQuery.ajaxSettings.xhr();

    support.cors = !!xhrSupported && ( "withCredentials" in xhrSupported );
    support.ajax = xhrSupported = !!xhrSupported;

    jQuery.ajaxTransport( function( options ) {
    	var callback, errorCallback;

    	// Cross domain only allowed if supported through XMLHttpRequest
    	if ( support.cors || xhrSupported && !options.crossDomain ) {
    		return {
    			send: function( headers, complete ) {
    				var i,
    					xhr = options.xhr();

    				xhr.open(
    					options.type,
    					options.url,
    					options.async,
    					options.username,
    					options.password
    				);

    				// Apply custom fields if provided
    				if ( options.xhrFields ) {
    					for ( i in options.xhrFields ) {
    						xhr[ i ] = options.xhrFields[ i ];
    					}
    				}

    				// Override mime type if needed
    				if ( options.mimeType && xhr.overrideMimeType ) {
    					xhr.overrideMimeType( options.mimeType );
    				}

    				// X-Requested-With header
    				// For cross-domain requests, seeing as conditions for a preflight are
    				// akin to a jigsaw puzzle, we simply never set it to be sure.
    				// (it can always be set on a per-request basis or even using ajaxSetup)
    				// For same-domain requests, won't change header if already provided.
    				if ( !options.crossDomain && !headers[ "X-Requested-With" ] ) {
    					headers[ "X-Requested-With" ] = "XMLHttpRequest";
    				}

    				// Set headers
    				for ( i in headers ) {
    					xhr.setRequestHeader( i, headers[ i ] );
    				}

    				// Callback
    				callback = function( type ) {
    					return function() {
    						if ( callback ) {
    							callback = errorCallback = xhr.onload =
    								xhr.onerror = xhr.onabort = xhr.ontimeout =
    									xhr.onreadystatechange = null;

    							if ( type === "abort" ) {
    								xhr.abort();
    							} else if ( type === "error" ) {

    								// Support: IE <=9 only
    								// On a manual native abort, IE9 throws
    								// errors on any property access that is not readyState
    								if ( typeof xhr.status !== "number" ) {
    									complete( 0, "error" );
    								} else {
    									complete(

    										// File: protocol always yields status 0; see #8605, #14207
    										xhr.status,
    										xhr.statusText
    									);
    								}
    							} else {
    								complete(
    									xhrSuccessStatus[ xhr.status ] || xhr.status,
    									xhr.statusText,

    									// Support: IE <=9 only
    									// IE9 has no XHR2 but throws on binary (trac-11426)
    									// For XHR2 non-text, let the caller handle it (gh-2498)
    									( xhr.responseType || "text" ) !== "text"  ||
    									typeof xhr.responseText !== "string" ?
    										{ binary: xhr.response } :
    										{ text: xhr.responseText },
    									xhr.getAllResponseHeaders()
    								);
    							}
    						}
    					};
    				};

    				// Listen to events
    				xhr.onload = callback();
    				errorCallback = xhr.onerror = xhr.ontimeout = callback( "error" );

    				// Support: IE 9 only
    				// Use onreadystatechange to replace onabort
    				// to handle uncaught aborts
    				if ( xhr.onabort !== undefined ) {
    					xhr.onabort = errorCallback;
    				} else {
    					xhr.onreadystatechange = function() {

    						// Check readyState before timeout as it changes
    						if ( xhr.readyState === 4 ) {

    							// Allow onerror to be called first,
    							// but that will not handle a native abort
    							// Also, save errorCallback to a variable
    							// as xhr.onerror cannot be accessed
    							window.setTimeout( function() {
    								if ( callback ) {
    									errorCallback();
    								}
    							} );
    						}
    					};
    				}

    				// Create the abort callback
    				callback = callback( "abort" );

    				try {

    					// Do send the request (this may raise an exception)
    					xhr.send( options.hasContent && options.data || null );
    				} catch ( e ) {

    					// #14683: Only rethrow if this hasn't been notified as an error yet
    					if ( callback ) {
    						throw e;
    					}
    				}
    			},

    			abort: function() {
    				if ( callback ) {
    					callback();
    				}
    			}
    		};
    	}
    } );




    // Prevent auto-execution of scripts when no explicit dataType was provided (See gh-2432)
    jQuery.ajaxPrefilter( function( s ) {
    	if ( s.crossDomain ) {
    		s.contents.script = false;
    	}
    } );

    // Install script dataType
    jQuery.ajaxSetup( {
    	accepts: {
    		script: "text/javascript, application/javascript, " +
    			"application/ecmascript, application/x-ecmascript"
    	},
    	contents: {
    		script: /\b(?:java|ecma)script\b/
    	},
    	converters: {
    		"text script": function( text ) {
    			jQuery.globalEval( text );
    			return text;
    		}
    	}
    } );

    // Handle cache's special case and crossDomain
    jQuery.ajaxPrefilter( "script", function( s ) {
    	if ( s.cache === undefined ) {
    		s.cache = false;
    	}
    	if ( s.crossDomain ) {
    		s.type = "GET";
    	}
    } );

    // Bind script tag hack transport
    jQuery.ajaxTransport( "script", function( s ) {

    	// This transport only deals with cross domain or forced-by-attrs requests
    	if ( s.crossDomain || s.scriptAttrs ) {
    		var script, callback;
    		return {
    			send: function( _, complete ) {
    				script = jQuery( "<script>" )
    					.attr( s.scriptAttrs || {} )
    					.prop( { charset: s.scriptCharset, src: s.url } )
    					.on( "load error", callback = function( evt ) {
    						script.remove();
    						callback = null;
    						if ( evt ) {
    							complete( evt.type === "error" ? 404 : 200, evt.type );
    						}
    					} );

    				// Use native DOM manipulation to avoid our domManip AJAX trickery
    				document.head.appendChild( script[ 0 ] );
    			},
    			abort: function() {
    				if ( callback ) {
    					callback();
    				}
    			}
    		};
    	}
    } );




    var oldCallbacks = [],
    	rjsonp = /(=)\?(?=&|$)|\?\?/;

    // Default jsonp settings
    jQuery.ajaxSetup( {
    	jsonp: "callback",
    	jsonpCallback: function() {
    		var callback = oldCallbacks.pop() || ( jQuery.expando + "_" + ( nonce.guid++ ) );
    		this[ callback ] = true;
    		return callback;
    	}
    } );

    // Detect, normalize options and install callbacks for jsonp requests
    jQuery.ajaxPrefilter( "json jsonp", function( s, originalSettings, jqXHR ) {

    	var callbackName, overwritten, responseContainer,
    		jsonProp = s.jsonp !== false && ( rjsonp.test( s.url ) ?
    			"url" :
    			typeof s.data === "string" &&
    				( s.contentType || "" )
    					.indexOf( "application/x-www-form-urlencoded" ) === 0 &&
    				rjsonp.test( s.data ) && "data"
    		);

    	// Handle iff the expected data type is "jsonp" or we have a parameter to set
    	if ( jsonProp || s.dataTypes[ 0 ] === "jsonp" ) {

    		// Get callback name, remembering preexisting value associated with it
    		callbackName = s.jsonpCallback = isFunction( s.jsonpCallback ) ?
    			s.jsonpCallback() :
    			s.jsonpCallback;

    		// Insert callback into url or form data
    		if ( jsonProp ) {
    			s[ jsonProp ] = s[ jsonProp ].replace( rjsonp, "$1" + callbackName );
    		} else if ( s.jsonp !== false ) {
    			s.url += ( rquery.test( s.url ) ? "&" : "?" ) + s.jsonp + "=" + callbackName;
    		}

    		// Use data converter to retrieve json after script execution
    		s.converters[ "script json" ] = function() {
    			if ( !responseContainer ) {
    				jQuery.error( callbackName + " was not called" );
    			}
    			return responseContainer[ 0 ];
    		};

    		// Force json dataType
    		s.dataTypes[ 0 ] = "json";

    		// Install callback
    		overwritten = window[ callbackName ];
    		window[ callbackName ] = function() {
    			responseContainer = arguments;
    		};

    		// Clean-up function (fires after converters)
    		jqXHR.always( function() {

    			// If previous value didn't exist - remove it
    			if ( overwritten === undefined ) {
    				jQuery( window ).removeProp( callbackName );

    			// Otherwise restore preexisting value
    			} else {
    				window[ callbackName ] = overwritten;
    			}

    			// Save back as free
    			if ( s[ callbackName ] ) {

    				// Make sure that re-using the options doesn't screw things around
    				s.jsonpCallback = originalSettings.jsonpCallback;

    				// Save the callback name for future use
    				oldCallbacks.push( callbackName );
    			}

    			// Call if it was a function and we have a response
    			if ( responseContainer && isFunction( overwritten ) ) {
    				overwritten( responseContainer[ 0 ] );
    			}

    			responseContainer = overwritten = undefined;
    		} );

    		// Delegate to script
    		return "script";
    	}
    } );




    // Support: Safari 8 only
    // In Safari 8 documents created via document.implementation.createHTMLDocument
    // collapse sibling forms: the second one becomes a child of the first one.
    // Because of that, this security measure has to be disabled in Safari 8.
    // https://bugs.webkit.org/show_bug.cgi?id=137337
    support.createHTMLDocument = ( function() {
    	var body = document.implementation.createHTMLDocument( "" ).body;
    	body.innerHTML = "<form></form><form></form>";
    	return body.childNodes.length === 2;
    } )();


    // Argument "data" should be string of html
    // context (optional): If specified, the fragment will be created in this context,
    // defaults to document
    // keepScripts (optional): If true, will include scripts passed in the html string
    jQuery.parseHTML = function( data, context, keepScripts ) {
    	if ( typeof data !== "string" ) {
    		return [];
    	}
    	if ( typeof context === "boolean" ) {
    		keepScripts = context;
    		context = false;
    	}

    	var base, parsed, scripts;

    	if ( !context ) {

    		// Stop scripts or inline event handlers from being executed immediately
    		// by using document.implementation
    		if ( support.createHTMLDocument ) {
    			context = document.implementation.createHTMLDocument( "" );

    			// Set the base href for the created document
    			// so any parsed elements with URLs
    			// are based on the document's URL (gh-2965)
    			base = context.createElement( "base" );
    			base.href = document.location.href;
    			context.head.appendChild( base );
    		} else {
    			context = document;
    		}
    	}

    	parsed = rsingleTag.exec( data );
    	scripts = !keepScripts && [];

    	// Single tag
    	if ( parsed ) {
    		return [ context.createElement( parsed[ 1 ] ) ];
    	}

    	parsed = buildFragment( [ data ], context, scripts );

    	if ( scripts && scripts.length ) {
    		jQuery( scripts ).remove();
    	}

    	return jQuery.merge( [], parsed.childNodes );
    };


    /**
     * Load a url into a page
     */
    jQuery.fn.load = function( url, params, callback ) {
    	var selector, type, response,
    		self = this,
    		off = url.indexOf( " " );

    	if ( off > -1 ) {
    		selector = stripAndCollapse( url.slice( off ) );
    		url = url.slice( 0, off );
    	}

    	// If it's a function
    	if ( isFunction( params ) ) {

    		// We assume that it's the callback
    		callback = params;
    		params = undefined;

    	// Otherwise, build a param string
    	} else if ( params && typeof params === "object" ) {
    		type = "POST";
    	}

    	// If we have elements to modify, make the request
    	if ( self.length > 0 ) {
    		jQuery.ajax( {
    			url: url,

    			// If "type" variable is undefined, then "GET" method will be used.
    			// Make value of this field explicit since
    			// user can override it through ajaxSetup method
    			type: type || "GET",
    			dataType: "html",
    			data: params
    		} ).done( function( responseText ) {

    			// Save response for use in complete callback
    			response = arguments;

    			self.html( selector ?

    				// If a selector was specified, locate the right elements in a dummy div
    				// Exclude scripts to avoid IE 'Permission Denied' errors
    				jQuery( "<div>" ).append( jQuery.parseHTML( responseText ) ).find( selector ) :

    				// Otherwise use the full result
    				responseText );

    		// If the request succeeds, this function gets "data", "status", "jqXHR"
    		// but they are ignored because response was set above.
    		// If it fails, this function gets "jqXHR", "status", "error"
    		} ).always( callback && function( jqXHR, status ) {
    			self.each( function() {
    				callback.apply( this, response || [ jqXHR.responseText, status, jqXHR ] );
    			} );
    		} );
    	}

    	return this;
    };




    jQuery.expr.pseudos.animated = function( elem ) {
    	return jQuery.grep( jQuery.timers, function( fn ) {
    		return elem === fn.elem;
    	} ).length;
    };




    jQuery.offset = {
    	setOffset: function( elem, options, i ) {
    		var curPosition, curLeft, curCSSTop, curTop, curOffset, curCSSLeft, calculatePosition,
    			position = jQuery.css( elem, "position" ),
    			curElem = jQuery( elem ),
    			props = {};

    		// Set position first, in-case top/left are set even on static elem
    		if ( position === "static" ) {
    			elem.style.position = "relative";
    		}

    		curOffset = curElem.offset();
    		curCSSTop = jQuery.css( elem, "top" );
    		curCSSLeft = jQuery.css( elem, "left" );
    		calculatePosition = ( position === "absolute" || position === "fixed" ) &&
    			( curCSSTop + curCSSLeft ).indexOf( "auto" ) > -1;

    		// Need to be able to calculate position if either
    		// top or left is auto and position is either absolute or fixed
    		if ( calculatePosition ) {
    			curPosition = curElem.position();
    			curTop = curPosition.top;
    			curLeft = curPosition.left;

    		} else {
    			curTop = parseFloat( curCSSTop ) || 0;
    			curLeft = parseFloat( curCSSLeft ) || 0;
    		}

    		if ( isFunction( options ) ) {

    			// Use jQuery.extend here to allow modification of coordinates argument (gh-1848)
    			options = options.call( elem, i, jQuery.extend( {}, curOffset ) );
    		}

    		if ( options.top != null ) {
    			props.top = ( options.top - curOffset.top ) + curTop;
    		}
    		if ( options.left != null ) {
    			props.left = ( options.left - curOffset.left ) + curLeft;
    		}

    		if ( "using" in options ) {
    			options.using.call( elem, props );

    		} else {
    			curElem.css( props );
    		}
    	}
    };

    jQuery.fn.extend( {

    	// offset() relates an element's border box to the document origin
    	offset: function( options ) {

    		// Preserve chaining for setter
    		if ( arguments.length ) {
    			return options === undefined ?
    				this :
    				this.each( function( i ) {
    					jQuery.offset.setOffset( this, options, i );
    				} );
    		}

    		var rect, win,
    			elem = this[ 0 ];

    		if ( !elem ) {
    			return;
    		}

    		// Return zeros for disconnected and hidden (display: none) elements (gh-2310)
    		// Support: IE <=11 only
    		// Running getBoundingClientRect on a
    		// disconnected node in IE throws an error
    		if ( !elem.getClientRects().length ) {
    			return { top: 0, left: 0 };
    		}

    		// Get document-relative position by adding viewport scroll to viewport-relative gBCR
    		rect = elem.getBoundingClientRect();
    		win = elem.ownerDocument.defaultView;
    		return {
    			top: rect.top + win.pageYOffset,
    			left: rect.left + win.pageXOffset
    		};
    	},

    	// position() relates an element's margin box to its offset parent's padding box
    	// This corresponds to the behavior of CSS absolute positioning
    	position: function() {
    		if ( !this[ 0 ] ) {
    			return;
    		}

    		var offsetParent, offset, doc,
    			elem = this[ 0 ],
    			parentOffset = { top: 0, left: 0 };

    		// position:fixed elements are offset from the viewport, which itself always has zero offset
    		if ( jQuery.css( elem, "position" ) === "fixed" ) {

    			// Assume position:fixed implies availability of getBoundingClientRect
    			offset = elem.getBoundingClientRect();

    		} else {
    			offset = this.offset();

    			// Account for the *real* offset parent, which can be the document or its root element
    			// when a statically positioned element is identified
    			doc = elem.ownerDocument;
    			offsetParent = elem.offsetParent || doc.documentElement;
    			while ( offsetParent &&
    				( offsetParent === doc.body || offsetParent === doc.documentElement ) &&
    				jQuery.css( offsetParent, "position" ) === "static" ) {

    				offsetParent = offsetParent.parentNode;
    			}
    			if ( offsetParent && offsetParent !== elem && offsetParent.nodeType === 1 ) {

    				// Incorporate borders into its offset, since they are outside its content origin
    				parentOffset = jQuery( offsetParent ).offset();
    				parentOffset.top += jQuery.css( offsetParent, "borderTopWidth", true );
    				parentOffset.left += jQuery.css( offsetParent, "borderLeftWidth", true );
    			}
    		}

    		// Subtract parent offsets and element margins
    		return {
    			top: offset.top - parentOffset.top - jQuery.css( elem, "marginTop", true ),
    			left: offset.left - parentOffset.left - jQuery.css( elem, "marginLeft", true )
    		};
    	},

    	// This method will return documentElement in the following cases:
    	// 1) For the element inside the iframe without offsetParent, this method will return
    	//    documentElement of the parent window
    	// 2) For the hidden or detached element
    	// 3) For body or html element, i.e. in case of the html node - it will return itself
    	//
    	// but those exceptions were never presented as a real life use-cases
    	// and might be considered as more preferable results.
    	//
    	// This logic, however, is not guaranteed and can change at any point in the future
    	offsetParent: function() {
    		return this.map( function() {
    			var offsetParent = this.offsetParent;

    			while ( offsetParent && jQuery.css( offsetParent, "position" ) === "static" ) {
    				offsetParent = offsetParent.offsetParent;
    			}

    			return offsetParent || documentElement;
    		} );
    	}
    } );

    // Create scrollLeft and scrollTop methods
    jQuery.each( { scrollLeft: "pageXOffset", scrollTop: "pageYOffset" }, function( method, prop ) {
    	var top = "pageYOffset" === prop;

    	jQuery.fn[ method ] = function( val ) {
    		return access( this, function( elem, method, val ) {

    			// Coalesce documents and windows
    			var win;
    			if ( isWindow( elem ) ) {
    				win = elem;
    			} else if ( elem.nodeType === 9 ) {
    				win = elem.defaultView;
    			}

    			if ( val === undefined ) {
    				return win ? win[ prop ] : elem[ method ];
    			}

    			if ( win ) {
    				win.scrollTo(
    					!top ? val : win.pageXOffset,
    					top ? val : win.pageYOffset
    				);

    			} else {
    				elem[ method ] = val;
    			}
    		}, method, val, arguments.length );
    	};
    } );

    // Support: Safari <=7 - 9.1, Chrome <=37 - 49
    // Add the top/left cssHooks using jQuery.fn.position
    // Webkit bug: https://bugs.webkit.org/show_bug.cgi?id=29084
    // Blink bug: https://bugs.chromium.org/p/chromium/issues/detail?id=589347
    // getComputedStyle returns percent when specified for top/left/bottom/right;
    // rather than make the css module depend on the offset module, just check for it here
    jQuery.each( [ "top", "left" ], function( _i, prop ) {
    	jQuery.cssHooks[ prop ] = addGetHookIf( support.pixelPosition,
    		function( elem, computed ) {
    			if ( computed ) {
    				computed = curCSS( elem, prop );

    				// If curCSS returns percentage, fallback to offset
    				return rnumnonpx.test( computed ) ?
    					jQuery( elem ).position()[ prop ] + "px" :
    					computed;
    			}
    		}
    	);
    } );


    // Create innerHeight, innerWidth, height, width, outerHeight and outerWidth methods
    jQuery.each( { Height: "height", Width: "width" }, function( name, type ) {
    	jQuery.each( {
    		padding: "inner" + name,
    		content: type,
    		"": "outer" + name
    	}, function( defaultExtra, funcName ) {

    		// Margin is only for outerHeight, outerWidth
    		jQuery.fn[ funcName ] = function( margin, value ) {
    			var chainable = arguments.length && ( defaultExtra || typeof margin !== "boolean" ),
    				extra = defaultExtra || ( margin === true || value === true ? "margin" : "border" );

    			return access( this, function( elem, type, value ) {
    				var doc;

    				if ( isWindow( elem ) ) {

    					// $( window ).outerWidth/Height return w/h including scrollbars (gh-1729)
    					return funcName.indexOf( "outer" ) === 0 ?
    						elem[ "inner" + name ] :
    						elem.document.documentElement[ "client" + name ];
    				}

    				// Get document width or height
    				if ( elem.nodeType === 9 ) {
    					doc = elem.documentElement;

    					// Either scroll[Width/Height] or offset[Width/Height] or client[Width/Height],
    					// whichever is greatest
    					return Math.max(
    						elem.body[ "scroll" + name ], doc[ "scroll" + name ],
    						elem.body[ "offset" + name ], doc[ "offset" + name ],
    						doc[ "client" + name ]
    					);
    				}

    				return value === undefined ?

    					// Get width or height on the element, requesting but not forcing parseFloat
    					jQuery.css( elem, type, extra ) :

    					// Set width or height on the element
    					jQuery.style( elem, type, value, extra );
    			}, type, chainable ? margin : undefined, chainable );
    		};
    	} );
    } );


    jQuery.each( [
    	"ajaxStart",
    	"ajaxStop",
    	"ajaxComplete",
    	"ajaxError",
    	"ajaxSuccess",
    	"ajaxSend"
    ], function( _i, type ) {
    	jQuery.fn[ type ] = function( fn ) {
    		return this.on( type, fn );
    	};
    } );




    jQuery.fn.extend( {

    	bind: function( types, data, fn ) {
    		return this.on( types, null, data, fn );
    	},
    	unbind: function( types, fn ) {
    		return this.off( types, null, fn );
    	},

    	delegate: function( selector, types, data, fn ) {
    		return this.on( types, selector, data, fn );
    	},
    	undelegate: function( selector, types, fn ) {

    		// ( namespace ) or ( selector, types [, fn] )
    		return arguments.length === 1 ?
    			this.off( selector, "**" ) :
    			this.off( types, selector || "**", fn );
    	},

    	hover: function( fnOver, fnOut ) {
    		return this.mouseenter( fnOver ).mouseleave( fnOut || fnOver );
    	}
    } );

    jQuery.each(
    	( "blur focus focusin focusout resize scroll click dblclick " +
    	"mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
    	"change select submit keydown keypress keyup contextmenu" ).split( " " ),
    	function( _i, name ) {

    		// Handle event binding
    		jQuery.fn[ name ] = function( data, fn ) {
    			return arguments.length > 0 ?
    				this.on( name, null, data, fn ) :
    				this.trigger( name );
    		};
    	}
    );




    // Support: Android <=4.0 only
    // Make sure we trim BOM and NBSP
    var rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;

    // Bind a function to a context, optionally partially applying any
    // arguments.
    // jQuery.proxy is deprecated to promote standards (specifically Function#bind)
    // However, it is not slated for removal any time soon
    jQuery.proxy = function( fn, context ) {
    	var tmp, args, proxy;

    	if ( typeof context === "string" ) {
    		tmp = fn[ context ];
    		context = fn;
    		fn = tmp;
    	}

    	// Quick check to determine if target is callable, in the spec
    	// this throws a TypeError, but we will just return undefined.
    	if ( !isFunction( fn ) ) {
    		return undefined;
    	}

    	// Simulated bind
    	args = slice.call( arguments, 2 );
    	proxy = function() {
    		return fn.apply( context || this, args.concat( slice.call( arguments ) ) );
    	};

    	// Set the guid of unique handler to the same of original handler, so it can be removed
    	proxy.guid = fn.guid = fn.guid || jQuery.guid++;

    	return proxy;
    };

    jQuery.holdReady = function( hold ) {
    	if ( hold ) {
    		jQuery.readyWait++;
    	} else {
    		jQuery.ready( true );
    	}
    };
    jQuery.isArray = Array.isArray;
    jQuery.parseJSON = JSON.parse;
    jQuery.nodeName = nodeName;
    jQuery.isFunction = isFunction;
    jQuery.isWindow = isWindow;
    jQuery.camelCase = camelCase;
    jQuery.type = toType;

    jQuery.now = Date.now;

    jQuery.isNumeric = function( obj ) {

    	// As of jQuery 3.0, isNumeric is limited to
    	// strings and numbers (primitives or objects)
    	// that can be coerced to finite numbers (gh-2662)
    	var type = jQuery.type( obj );
    	return ( type === "number" || type === "string" ) &&

    		// parseFloat NaNs numeric-cast false positives ("")
    		// ...but misinterprets leading-number strings, particularly hex literals ("0x...")
    		// subtraction forces infinities to NaN
    		!isNaN( obj - parseFloat( obj ) );
    };

    jQuery.trim = function( text ) {
    	return text == null ?
    		"" :
    		( text + "" ).replace( rtrim, "" );
    };




    var

    	// Map over jQuery in case of overwrite
    	_jQuery = window.jQuery,

    	// Map over the $ in case of overwrite
    	_$ = window.$;

    jQuery.noConflict = function( deep ) {
    	if ( window.$ === jQuery ) {
    		window.$ = _$;
    	}

    	if ( deep && window.jQuery === jQuery ) {
    		window.jQuery = _jQuery;
    	}

    	return jQuery;
    };

    // Expose jQuery and $ identifiers, even in AMD
    // (#7102#comment:10, https://github.com/jquery/jquery/pull/557)
    // and CommonJS for browser emulators (#13566)
    if ( typeof noGlobal === "undefined" ) {
    	window.jQuery = window.$ = jQuery;
    }




    return jQuery;
    } );
    });

    function is_date(obj) {
        return Object.prototype.toString.call(obj) === '[object Date]';
    }

    function get_interpolator(a, b) {
        if (a === b || a !== a)
            return () => a;
        const type = typeof a;
        if (type !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
            throw new Error('Cannot interpolate values of different type');
        }
        if (Array.isArray(a)) {
            const arr = b.map((bi, i) => {
                return get_interpolator(a[i], bi);
            });
            return t => arr.map(fn => fn(t));
        }
        if (type === 'object') {
            if (!a || !b)
                throw new Error('Object cannot be null');
            if (is_date(a) && is_date(b)) {
                a = a.getTime();
                b = b.getTime();
                const delta = b - a;
                return t => new Date(a + t * delta);
            }
            const keys = Object.keys(b);
            const interpolators = {};
            keys.forEach(key => {
                interpolators[key] = get_interpolator(a[key], b[key]);
            });
            return t => {
                const result = {};
                keys.forEach(key => {
                    result[key] = interpolators[key](t);
                });
                return result;
            };
        }
        if (type === 'number') {
            const delta = b - a;
            return t => a + t * delta;
        }
        throw new Error(`Cannot interpolate ${type} values`);
    }
    function tweened(value, defaults = {}) {
        const store = writable(value);
        let task;
        let target_value = value;
        function set(new_value, opts) {
            if (value == null) {
                store.set(value = new_value);
                return Promise.resolve();
            }
            target_value = new_value;
            let previous_task = task;
            let started = false;
            let { delay = 0, duration = 400, easing = identity, interpolate = get_interpolator } = assign(assign({}, defaults), opts);
            if (duration === 0) {
                if (previous_task) {
                    previous_task.abort();
                    previous_task = null;
                }
                store.set(value = target_value);
                return Promise.resolve();
            }
            const start = now() + delay;
            let fn;
            task = loop(now => {
                if (now < start)
                    return true;
                if (!started) {
                    fn = interpolate(value, new_value);
                    if (typeof duration === 'function')
                        duration = duration(value, new_value);
                    started = true;
                }
                if (previous_task) {
                    previous_task.abort();
                    previous_task = null;
                }
                const elapsed = now - start;
                if (elapsed > duration) {
                    store.set(value = new_value);
                    return false;
                }
                // @ts-ignore
                store.set(value = fn(easing(elapsed / duration)));
                return true;
            });
            return task.promise;
        }
        return {
            set,
            update: (fn, opts) => set(fn(target_value, value), opts),
            subscribe: store.subscribe
        };
    }

    const WsSubscribers = {
        __subscribers: {},
        websocket: undefined,
        webSocketConnected: false,
        registerQueue: [],
        init: function(port, debug, debugFilters) {
            port = port || 49322;
            debug = debug || false;
            if (debug) {
                if (debugFilters !== undefined) {
                    console.warn("WebSocket Debug Mode enabled with filtering. Only events not in the filter list will be dumped");
                } else {
                    console.warn("WebSocket Debug Mode enabled without filters applied. All events will be dumped to console");
                    console.warn("To use filters, pass in an array of 'channel:event' strings to the second parameter of the init function");
                }
            }
            WsSubscribers.webSocket = new WebSocket("ws://localhost:" + port);
            WsSubscribers.webSocket.onmessage = function (event) {
                let jEvent = JSON.parse(event.data);
                if (!jEvent.hasOwnProperty('event')) {
                    return;
                }
                let eventSplit = jEvent.event.split(':');
                let channel = eventSplit[0];
                let event_event = eventSplit[1];
                if (debug) {
                    if (!debugFilters) {
                        console.log(channel, event_event, jEvent);
                    } else if (debugFilters && debugFilters.indexOf(jEvent.event) < 0) {
                        console.log(channel, event_event, jEvent);
                    }
                }
                WsSubscribers.triggerSubscribers(channel, event_event, jEvent.data);
            };
            WsSubscribers.webSocket.onopen = function () {
                WsSubscribers.triggerSubscribers("ws", "open");
                WsSubscribers.webSocketConnected = true;
                WsSubscribers.registerQueue.forEach((r) => {
                    WsSubscribers.send("wsRelay", "register", r);
                });
                WsSubscribers.registerQueue = [];
            };
            WsSubscribers.webSocket.onerror = function () {
                WsSubscribers.triggerSubscribers("ws", "error");
                WsSubscribers.webSocketConnected = false;
            };
            WsSubscribers.webSocket.onclose = function () {
                WsSubscribers.triggerSubscribers("ws", "close");
                WsSubscribers.webSocketConnected = false;
            };
        },
        /**
         * Add callbacks for when certain events are thrown
         * Execution is guaranteed to be in First In First Out order
         * @param channels
         * @param events
         * @param callback
         */
        subscribe: function(channels, events, callback) {
            if (typeof channels === "string") {
                let channel = channels;
                channels = [];
                channels.push(channel);
            }
            if (typeof events === "string") {
                let event = events;
                events = [];
                events.push(event);
            }
            channels.forEach(function(c) {
                events.forEach(function (e) {
                    if (!WsSubscribers.__subscribers.hasOwnProperty(c)) {
                        WsSubscribers.__subscribers[c] = {};
                    }
                    if (!WsSubscribers.__subscribers[c].hasOwnProperty(e)) {
                        WsSubscribers.__subscribers[c][e] = [];
                        if (WsSubscribers.webSocketConnected) {
                            WsSubscribers.send("wsRelay", "register", `${c}:${e}`);
                        } else {
                            WsSubscribers.registerQueue.push(`${c}:${e}`);
                        }
                    }
                    WsSubscribers.__subscribers[c][e].push(callback);
                });
            });
        },
        clearEventCallbacks: function (channel, event) {
            if (WsSubscribers.__subscribers.hasOwnProperty(channel) && WsSubscribers.__subscribers[channel].hasOwnProperty(event)) {
                WsSubscribers.__subscribers[channel] = {};
            }
        },
        triggerSubscribers: function (channel, event, data) {
            if (WsSubscribers.__subscribers.hasOwnProperty(channel) && WsSubscribers.__subscribers[channel].hasOwnProperty(event)) {
                WsSubscribers.__subscribers[channel][event].forEach(function(callback) {
                    if (callback instanceof Function) {
                        callback(data);
                    }
                });
            }
        },
        send: function (channel, event, data) {
            if (typeof channel !== 'string') {
                console.error("Channel must be a string");
                return;
            }
            if (typeof event !== 'string') {
                console.error("Event must be a string");
                return;
            }
            if (channel === 'local') {
                this.triggerSubscribers(channel, event, data);
            } else {
                let cEvent = channel + ":" + event;
                WsSubscribers.webSocket.send(JSON.stringify({
                    'event': cEvent,
                    'data': data
                }));
            }
        }
    };

    const pbpVideo = writable('');
    const colorVideo = writable('');
    const pbpName = writable('');
    const colorName = writable('');
    const pbpImage = writable('');
    const colorImage = writable('');
    const tickerInfo = writable('');
    const currentScene = writable('desk');
    const casterDisplay = tweened(0, {
      duration: 1000
    });const powerRankings = writable([]);
    const tonightGames = writable([]);
    const league = writable('');
    const teamPlayers1 = writable([]);

    let stop = false;

    let teamMap = {
        "ascension": {
          "1": " #ffcf56",
          "2": " #18020c",
          "3": " #000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771051087062630430/Ascension_Logo.png"
        },
        "bulls": {
          "1": "#4c2719",
          "2": "#000001",
          "3": "#18020c",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771051080858468363/Bulls_Logo.png"
        },
        "cobras": {
          "1": "#f49d37",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771051085514539048/Cobras_Logo.png"
        },
        "ducks": {
          "1": "#226f54",
          "2": "#f6aa1c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771049884321054720/Ducks_Logo.png"
        },
        "eagles": {
          "1": "#0072bb",
          "2": "#9cf6f6",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771049887906791464/Eagles_Logo.png"
        },
        "flames": {
          "1": "#f49d37",
          "2": "#18020c",
          "3": "#f72c25",
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/679756528567451683/Flames_Logo.png"
        },
        "hawks": {
          "1": "#f42b03",
          "2": "#000001",
          "3": "#d3d5d7",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771049891488464927/Hawks_Logo.png"
        },
        "kings": {
          "1": "#ffd046",
          "2": "#000001",
          "3": "#d3d5d7",
          "logo": "https://cdn.discordapp.com/attachments/324268285703094273/648721158174146580/Kings_Logo.png"
        },
        "lions": {
          "1": "#d3d5d7",
          "2": "#000001",
          "3": "#18020c",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771049894517014578/Lions_Logo.png"
        },
        "lumberjacks": {
          "1": "#393a10",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771049897256288266/Lumberjacks_Logo.png"
        },
        "panthers": {
          "1": "#f42b03",
          "2": "#890620",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771049902117224468/Panthers_Logo.png"
        },
        "pirates": {
          "1": "#960200",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/324268285703094273/641071922712412174/Pirates_Logo.png"
        },
        "sharks": {
          "1": "#1f487e",
          "2": "#000001",
          "3": "#18020c",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771049903723511888/Sharks_Logo.png"
        },
        "spartans": {
          "1": "#5f5aa2",
          "2": "#d3d5d7",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771049907149865000/Spartans_Logo.png"
        },
        "storm": {
          "1": "#fcba04",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/402228472744902656/469553106393235466/dragon-01-1.png"
        },
        "whitecaps": {
          "1": "#c9f9ff",
          "2": "#000001",
          "3": "#18020c",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771049910224814080/Whitecaps_Logo.png"
        },
        "bobcats": {
          "1": "#f42b03",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053393082318858/Bobcats_Logo.png"
        },
        "bulldogs": {
          "1": "#c7ccdb",
          "2": "#000001",
          "3": "#18020c",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053399206264922/Bulldogs_Logo.png"
        },
        "dolphins": {
          "1": "#b8e1ff",
          "2": "#000001",
          "3": "#18020c",
          "logo": "https://cdn.discordapp.com/attachments/324268285703094273/648718145338736650/Dolphins_Logo.png"
        },
        "entropy": {
          "1": "#f49d37",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053405337681920/Entropy_Logo.png"
        },
        "geese": {
          "1": "#393a10",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053411755491328/Geese_Logo.png"
        },
        "heat": {
          "1": "#f49d37",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053416562032660/Heat_Logo.png"
        },
        "knights": {
          "1": "#18020c",
          "2": "#e9df00",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053345845674020/Knights_Logo.png"
        },
        "osprey": {
          "1": "#ee2e31",
          "2": "#000001",
          "3": "#18020c",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053352686977064/Osprey_Logo.png"
        },
        "owls": {
          "1": "#4c230a",
          "2": "#000001",
          "3": "#18020c",
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/654074318631862282/Owls_Logo.png"
        },
        "pioneers": {
          "1": "#656839",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053359012642816/Pioneers_Logo.png"
        },
        "raiders": {
          "1": "#d3d5d7",
          "2": "#e9df00",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/654074118492389376/Raiders_Logo.png"
        },
        "thunder": {
          "1": "#e9df00",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053364338360340/Thunder_Logo.png"
        },
        "tigers": {
          "1": "#f49d37",
          "2": "#000001",
          "3": "#18020c",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053370752106506/Tigers_Logo.png"
        },
        "trojans": {
          "1": "#18020c",
          "2": "#e9df00",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053378343927848/Trojans_Logo.png"
        },
        "tundra": {
          "1": "#2660a4",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/677666710169583647/Tundra_Logo.png"
        },
        "vipers": {
          "1": "#ff8c42",
          "2": "#000001",
          "3": "#18020c",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771053385294020658/Vipers_Logo.png"
        },
        "avalanche": {
          "1": "#000001",
          "2": "#4ecdc4",
          "3": "#18020c",
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/667163655065829403/Avalanche_Logo.png"
        },
        "bandits": {
          "1": "#18020c",
          "2": "#000001",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771055539521191997/Bandits_Logo.png"
        },
        "barracuda": {
          "1": "#2660a4",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/768905494941007882/Barracuda_Logo.png"
        },
        "dukes": {
          "1": "#18020c",
          "2": "#881600",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/663779106583740446/Dukes_Logo.png"
        },
        "falcons": {
          "1": "#5bc3eb",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/324268285703094273/648727754711498793/Falcons_Logo.png"
        },
        "herons": {
          "1": "#a4af69",
          "2": "#000001",
          "3": "#18020c",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771069879373660180/Herons_Logo.png"
        },
        "inferno": {
          "1": "#e57c04",
          "2": "#bf1a2f",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771055542869295174/Inferno_Logo.png"
        },
        "jaguars": {
          "1": "#f42b03",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771055545598869564/Jaguars_Logo_3.png"
        },
        "lightning": {
          "1": "#f7d002",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/768223943085129728/Lightning_Logo.png"
        },
        "lynx": {
          "1": "#18020c",
          "2": "#f7d002",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771055549412409354/Lynx_Logo_2.png"
        },
        "mustangs": {
          "1": "#4c1c00",
          "2": "#000001",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771055552147095602/Mustangs_Logo_2.png"
        },
        "pulsars": {
          "1": "#32936f",
          "2": "#387d7a",
          "3": "#2bc016",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771055554603778068/Pulars2.png"
        },
        "pythons": {
          "1": "#ff8c42",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771055558321111080/Pythons_Logo_3.png"
        },
        "voyagers": {
          "1": "#0c8346",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771055561604595722/Voyagers_Logo_2.png"
        },
        "vultures": {
          "1": "#587291",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/663389725188423680/Vultures_Logo.png"
        },
        "warriors": {
          "1": "#7c238c",
          "2": "#7c72a0",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771055564604178442/Warriors_Logo_2.png"
        },
        "cardinals": {
          "1": "#a22c29",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/663392854227419136/Cardinals_Logo.png"
        },
        "cougars": {
          "1": "#f7b32b",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/324268285703094273/696145820034269224/Cougars_Logo_2.png"
        },
        "embers": {
          "1": "#dc493a",
          "2": "#a22c29",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771072411239972904/Embers_Logo.png"
        },
        "eskimos": {
          "1": "#e3ebff",
          "2": "#000001",
          "3": "#18020c",
          "logo": "https://cdn.discordapp.com/attachments/324268285703094273/655261559970594826/Eskimos_Logo.png"
        },
        "genesis": {
          "1": "#4392f1",
          "2": "#000001",
          "3": "#18020c",
          "logo": "https://cdn.discordapp.com/attachments/324268285703094273/641101909658173450/genesisfinal2.png"
        },
        "gulls": {
          "1": "#f49d37",
          "2": "#000001",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/324268285703094273/648718182772768768/Gulls_Logo.png"
        },
        "jesters": {
          "1": "#fed766",
          "2": "#2ab7ca",
          "3": "#fe4a49",
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/654074080810631178/Jesters_Logo.png"
        },
        "leopards": {
          "1": "#f42b03",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771056600773165146/Leopards_Logo_2.png"
        },
        "miners": {
          "1": "#e8c547",
          "2": "#698f3f",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771056602873724938/Miners_Logo_3.png"
        },
        "pelicans": {
          "1": "#5c80bc",
          "2": "#000001",
          "3": "#18020c",
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/663779353095700530/Pelicans_Logo.png"
        },
        "rattlers": {
          "1": "#a2c7e5",
          "2": "#000001",
          "3": "#18020c",
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/654740981815574529/Rattlers_Logo.png"
        },
        "ravens": {
          "1": "#bd1e1e",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/663389781732098068/Ravens_Logo.png"
        },
        "stallions": {
          "1": "#d68c45",
          "2": "#e0e0ce",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/654074869943762955/Stallions_Logo.png"
        },
        "tempest": {
          "1": "#e6c229",
          "2": "#000001",
          "3": "#18020c",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771056606829084702/Tempest_Logo_2.png"
        },
        "titans": {
          "1": "#698f3f",
          "2": "#c1b2ab",
          "3": "#18020c",
          "logo": "https://cdn.discordapp.com/attachments/324268285703094273/648720610704228362/Titans_Logo.png"
        },
        "wranglers": {
          "1": "#ff2e00",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771056608150290462/Wranglers_Logo.png"
        },
        "admirals": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771058776466784286/Admirals_Logo.png"
        },
        "dragons": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771058785246511175/Dragons_Logo.png"
        },
        "beavers": {
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/715361176707399741/Beavers_Logo.png"
        },
        "cyclones": {
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/717733534101668010/Cyclones_Logo.png"
        },
        "grizzlies": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771058779232010250/Bears_Logo.png"
        },
        "centurions": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771058781915578399/Centurions_Logo.png"
        },
        "yellow jackets": {
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/730457373126426654/Yellow_Jackets_logo.png"
        },
        "galaxy": {
          "logo": "https://cdn.discordapp.com/attachments/755840403080478832/767476330643193886/Galaxy_Logo.png"
        },
        "sockeyes": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771058789113397268/Sockeyes_Logo.png"
        },
        "wolves": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771058773192212496/Wolves_Logo.png"
        },
        "wildcats": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771058794045767730/Wildcats_Logo.png"
        },
        "rhinos": {
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/734490021079548005/Rhinos_Logo.png"
        },
        "scorpions": {
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/730457572397678592/Scorpions_Logo.png"
        },
        "thrashers": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771058791676117012/Thrashers_Logo.png"
        },
        "toucans": {
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/730457120654229584/Toucans_logo.png"
        },
        "wizards": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771058797326106694/Wizards_Logo.png"
        },
        "captains": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771060591338061874/Captains_Logo.png"
        },
        "yetis": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771060585554378762/Yetis_Logo.png"
        },
        "otters": {
          "logo": "https://cdn.discordapp.com/attachments/421796377303973888/755863732193591418/Otters_Logo.png"
        },
        "tides": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771060583024820254/Tides_Logo.png"
        },
        "pandas": {
          "logo": "https://cdn.discordapp.com/attachments/324268285703094273/730511590088245268/Pandas_Logo.png"
        },
        "samurai": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771060577840660490/Samurai_Logo.png"
        },
        "hornets": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771060644685545512/Hornets_Logo.png"
        },
        "solar": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771075279300329512/Solar_Logo.png"
        },
        "piranhas": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771060572245983303/Piranhas_Logo.png"
        },
        "terriers": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771060579968090122/Terriers_Logo.png"
        },
        "jackrabbits": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771060566437396500/Jackrabbits_Logo_2.png"
        },
        "zebras": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771060588239126528/Zebras_Logo.png"
        },
        "camels": {
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/738138000264790106/Camels_Logo.png"
        },
        "raptors": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771079922302713856/Raptors_Logo.png"
        },
        "macaws": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771060569527681064/Macaws_Logo.png"
        },
        "mages": {
          "logo": "https://cdn.discordapp.com/attachments/696962499177742476/771077495772020751/Mages_Logo.png"
        },
        "turtles": {
          "1": "#ff2e00",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/715062285554548746/Turtles_logo.png"
        },
        "rams": {
          "1": "#ff2e00",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/421796377303973888/758719416321441892/Rams_Logo_2.png"
        },
        "cowboys": {
          "1": "#ff2e00",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/421796377303973888/758723087909781543/Cowboys_Logo_2.png"
        },
        "flowerhorns": {
          "1": "#ff2e00",
          "2": "#18020c",
          "3": "#000001",
          "logo": "https://cdn.discordapp.com/attachments/394574231066640387/715062260480999464/Flowerhorns_Logo.png"
        }
      };

    WsSubscribers.subscribe("ws", "open", function() {
        WsSubscribers.send("cb", "first_connect", {
            'name': 'Scorebug'
        });
        setInterval(function () {
            WsSubscribers.send("cb", "heartbeat", "heartbeat");
        }, 1000);
    });

    WsSubscribers.init(49322, false, [
        "game:update_state",
        "cb:heartbeat"
    ]);

    WsSubscribers.subscribe("sos", "casters_update", (d) => {
        console.log(d['casters']);
        pbpVideo.set(d['casters']['left']['obs']);
        colorVideo.set(d['casters']['right']['obs']);
        stop = true;
        currentScene.set('caster');
        casterDisplay.set(1);
      });

    function updateCasters() {
        if (!stop) {
            var url = "https://spreadsheets.google.com/feeds/cells/1mDV2D9MRoYX-7f4eBDlllvBq-kewCFQ6kRbCf3ML6uk/od6/public/basic?alt=json";
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200) {
                    var obj = JSON.parse(this.response);
                    var i;
                    var tickerInfoLocal = '';
                    var powerRankingsLocal = [];
                    var entry = obj['feed']['entry'];
                    var games1 = {top:100};
                    var games2 = {top:350};
                    var games3 = {top:600};
                    var games4 = {top:850};
                    var games = [];
                    var player1 = {};
                    var team1 = [];
                    for (i = 0; i < entry.length; i++) {
                        obj['feed']['entry'][i]['title']['$t'].slice(-2);
                        if (obj['feed']['entry'][i]['title']['$t'] == "H12") {
                            pbpVideo.set(obj['feed']['entry'][i]['content']['$t']);
                        } else if (obj['feed']['entry'][i]['title']['$t'] == "H13") {
                            colorVideo.set(obj['feed']['entry'][i]['content']['$t']);
                        } else if (obj['feed']['entry'][i]['title']['$t'] == "I23") {
                            pbpName.set(obj['feed']['entry'][i]['content']['$t']);
                        } else if (obj['feed']['entry'][i]['title']['$t'] == "J23") {
                            pbpImage.set(obj['feed']['entry'][i]['content']['$t']);
                        } else if (obj['feed']['entry'][i]['title']['$t'] == "I24") {
                            colorName.set(obj['feed']['entry'][i]['content']['$t']);
                        } else if (obj['feed']['entry'][i]['title']['$t'] == "J24") {
                            colorImage.set(obj['feed']['entry'][i]['content']['$t']);
                        } else if (obj['feed']['entry'][i]['title']['$t'] == "B5") {
                            var tempAr = obj['feed']['entry'][i]['content']['$t'].split(",");
                            tickerInfoLocal = tickerInfoLocal + "<p style='padding-left: 25px;'>" + tempAr[0] + " " + tempAr[1] + "-" + tempAr[2] + " " + tempAr[3] + "</p><p style='padding-left: 25px;'>|</p>";
                        } else if (obj['feed']['entry'][i]['title']['$t'] == "B5") {
                            var tempAr = obj['feed']['entry'][i]['content']['$t'].split(",");
                            tickerInfoLocal = tickerInfoLocal + "<p style='padding-left: 25px;'>" + tempAr[0] + " " + tempAr[1] + "-" + tempAr[2] + " " + tempAr[3] + "</p><p style='padding-left: 25px;'>|</p>";
                        } else if (obj['feed']['entry'][i]['title']['$t'] == "B6") {
                            var tempAr = obj['feed']['entry'][i]['content']['$t'].split(",");
                            tickerInfoLocal = tickerInfoLocal + "<p style='padding-left: 25px;'>" + tempAr[0] + " " + tempAr[1] + "-" + tempAr[2] + " " + tempAr[3] + "</p><p style='padding-left: 25px;'>|</p>";
                        } else if (obj['feed']['entry'][i]['title']['$t'] == "B7") {
                            var tempAr = obj['feed']['entry'][i]['content']['$t'].split(",");
                            tickerInfoLocal = tickerInfoLocal + "<p style='padding-left: 25px;'>" + tempAr[0] + " " + tempAr[1] + "-" + tempAr[2] + " " + tempAr[3] + "</p><p style='padding-left: 25px;'>|</p>";
                        } else if (obj['feed']['entry'][i]['title']['$t'] == "B8") {
                            var tempAr = obj['feed']['entry'][i]['content']['$t'].split(",");
                            tickerInfoLocal = tickerInfoLocal + "<p style='padding-left: 25px;'>" + tempAr[0] + " " + tempAr[1] + "-" + tempAr[2] + " " + tempAr[3] + "</p><p style='padding-left: 25px;'>|</p>";
                        } else if (obj['feed']['entry'][i]['title']['$t'] == "B9") {
                            var tempAr = obj['feed']['entry'][i]['content']['$t'].split(",");
                            tickerInfoLocal = tickerInfoLocal + "<p style='padding-left: 25px;'>" + tempAr[0] + " " + tempAr[1] + "-" + tempAr[2] + " " + tempAr[3] + "</p><p style='padding-left: 25px;'>|</p>";
                        } else if (obj['feed']['entry'][i]['title']['$t'] == "B10") {
                            var tempAr = obj['feed']['entry'][i]['content']['$t'].split(",");
                            tickerInfoLocal = tickerInfoLocal + "<p style='padding-left: 25px;'>" + tempAr[0] + " " + tempAr[1] + "-" + tempAr[2] + " " + tempAr[3] + "</p><p style='padding-left: 25px;'>|</p>";
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "I47") {
                            var powerRankingsLocalTemp = {id:1};
                            powerRankingsLocalTemp['top'] = 1 * 100;
                            powerRankingsLocalTemp['left'] = 0;
                            powerRankingsLocalTemp['team'] = obj['feed']['entry'][i]['content']['$t'];
                            var lower = obj['feed']['entry'][i]['content']['$t'].toLowerCase();
                            if (teamMap.hasOwnProperty(lower.toLowerCase())) {
                                powerRankingsLocalTemp['logo'] = teamMap[lower]['logo'];
                            }
                            powerRankingsLocal.push(powerRankingsLocalTemp);
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "I48") {
                            var powerRankingsLocalTemp = {id:2};
                            powerRankingsLocalTemp['top'] = 2 * 100;
                            powerRankingsLocalTemp['left'] = 0;
                            powerRankingsLocalTemp['team'] = obj['feed']['entry'][i]['content']['$t'];
                            var lower = obj['feed']['entry'][i]['content']['$t'].toLowerCase();
                            if (teamMap.hasOwnProperty(lower.toLowerCase())) {
                                powerRankingsLocalTemp['logo'] = teamMap[lower]['logo'];
                            }
                            powerRankingsLocal.push(powerRankingsLocalTemp);
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "I49") {
                            var powerRankingsLocalTemp = {id:3};
                            powerRankingsLocalTemp['top'] = 3 * 100;
                            powerRankingsLocalTemp['left'] = 0;
                            powerRankingsLocalTemp['team'] = obj['feed']['entry'][i]['content']['$t'];
                            var lower = obj['feed']['entry'][i]['content']['$t'].toLowerCase();
                            if (teamMap.hasOwnProperty(lower.toLowerCase())) {
                                powerRankingsLocalTemp['logo'] = teamMap[lower]['logo'];
                            }
                            powerRankingsLocal.push(powerRankingsLocalTemp);
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "I50") {
                            var powerRankingsLocalTemp = {id:4};
                            powerRankingsLocalTemp['top'] = 4 * 100;
                            powerRankingsLocalTemp['left'] = 0;
                            powerRankingsLocalTemp['team'] = obj['feed']['entry'][i]['content']['$t'];
                            var lower = obj['feed']['entry'][i]['content']['$t'].toLowerCase();
                            if (teamMap.hasOwnProperty(lower.toLowerCase())) {
                                powerRankingsLocalTemp['logo'] = teamMap[lower]['logo'];
                            }
                            powerRankingsLocal.push(powerRankingsLocalTemp);
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "I51") {
                            var powerRankingsLocalTemp = {id:5};
                            powerRankingsLocalTemp['top'] = 5 * 100;
                            powerRankingsLocalTemp['left'] = 0;
                            powerRankingsLocalTemp['team'] = obj['feed']['entry'][i]['content']['$t'];
                            var lower = obj['feed']['entry'][i]['content']['$t'].toLowerCase();
                            if (teamMap.hasOwnProperty(lower.toLowerCase())) {
                                powerRankingsLocalTemp['logo'] = teamMap[lower]['logo'];
                            }
                            powerRankingsLocal.push(powerRankingsLocalTemp);
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "I52") {
                            var powerRankingsLocalTemp = {id:6};
                            powerRankingsLocalTemp['top'] = 6 * 100;
                            powerRankingsLocalTemp['left'] = 0;
                            powerRankingsLocalTemp['team'] = obj['feed']['entry'][i]['content']['$t'];
                            var lower = obj['feed']['entry'][i]['content']['$t'].toLowerCase();
                            if (teamMap.hasOwnProperty(lower.toLowerCase())) {
                                powerRankingsLocalTemp['logo'] = teamMap[lower]['logo'];
                            }
                            powerRankingsLocal.push(powerRankingsLocalTemp);
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "I53") {
                            var powerRankingsLocalTemp = {id:7};
                            powerRankingsLocalTemp['top'] = 7 * 100;
                            powerRankingsLocalTemp['left'] = 0;
                            powerRankingsLocalTemp['team'] = obj['feed']['entry'][i]['content']['$t'];
                            var lower = obj['feed']['entry'][i]['content']['$t'].toLowerCase();
                            if (teamMap.hasOwnProperty(lower.toLowerCase())) {
                                powerRankingsLocalTemp['logo'] = teamMap[lower]['logo'];
                            }
                            powerRankingsLocal.push(powerRankingsLocalTemp);
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "I54") {
                            var powerRankingsLocalTemp = {id:8};
                            powerRankingsLocalTemp['top'] = 8 * 100;
                            powerRankingsLocalTemp['left'] = 0;
                            powerRankingsLocalTemp['team'] = obj['feed']['entry'][i]['content']['$t'];
                            var lower = obj['feed']['entry'][i]['content']['$t'].toLowerCase();
                            if (teamMap.hasOwnProperty(lower.toLowerCase())) {
                                powerRankingsLocalTemp['logo'] = teamMap[lower]['logo'];
                            }
                            powerRankingsLocal.push(powerRankingsLocalTemp);
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "I55") {
                            var powerRankingsLocalTemp = {id:9};
                            powerRankingsLocalTemp['top'] =(9-8) * 100;
                            powerRankingsLocalTemp['left'] = 500;
                            powerRankingsLocalTemp['team'] = obj['feed']['entry'][i]['content']['$t'];
                            var lower = obj['feed']['entry'][i]['content']['$t'].toLowerCase();
                            if (teamMap.hasOwnProperty(lower.toLowerCase())) {
                                powerRankingsLocalTemp['logo'] = teamMap[lower]['logo'];
                            }
                            powerRankingsLocal.push(powerRankingsLocalTemp);
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "I56") {
                            var powerRankingsLocalTemp = {id:10};
                            powerRankingsLocalTemp['top'] = (10-8) * 100;
                            powerRankingsLocalTemp['left'] = 500;
                            powerRankingsLocalTemp['team'] = obj['feed']['entry'][i]['content']['$t'];
                            var lower = obj['feed']['entry'][i]['content']['$t'].toLowerCase();
                            if (teamMap.hasOwnProperty(lower.toLowerCase())) {
                                powerRankingsLocalTemp['logo'] = teamMap[lower]['logo'];
                            }
                            powerRankingsLocal.push(powerRankingsLocalTemp);
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "I57") {
                            var powerRankingsLocalTemp = {id:11};
                            powerRankingsLocalTemp['top'] = (11-8) * 100;
                            powerRankingsLocalTemp['left'] = 500;
                            powerRankingsLocalTemp['team'] = obj['feed']['entry'][i]['content']['$t'];
                            var lower = obj['feed']['entry'][i]['content']['$t'].toLowerCase();
                            if (teamMap.hasOwnProperty(lower.toLowerCase())) {
                                powerRankingsLocalTemp['logo'] = teamMap[lower]['logo'];
                            }
                            powerRankingsLocal.push(powerRankingsLocalTemp);
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "I58") {
                            var powerRankingsLocalTemp = {id:12};
                            powerRankingsLocalTemp['top'] = (12-8) * 100;
                            powerRankingsLocalTemp['left'] = 500;
                            powerRankingsLocalTemp['team'] = obj['feed']['entry'][i]['content']['$t'];
                            var lower = obj['feed']['entry'][i]['content']['$t'].toLowerCase();
                            if (teamMap.hasOwnProperty(lower.toLowerCase())) {
                                powerRankingsLocalTemp['logo'] = teamMap[lower]['logo'];
                            }
                            powerRankingsLocal.push(powerRankingsLocalTemp);
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "I59") {
                            var powerRankingsLocalTemp = {id:13};
                            powerRankingsLocalTemp['top'] = (13-8) * 100;
                            powerRankingsLocalTemp['left'] = 500;
                            powerRankingsLocalTemp['team'] = obj['feed']['entry'][i]['content']['$t'];
                            var lower = obj['feed']['entry'][i]['content']['$t'].toLowerCase();
                            if (teamMap.hasOwnProperty(lower.toLowerCase())) {
                                powerRankingsLocalTemp['logo'] = teamMap[lower]['logo'];
                            }
                            powerRankingsLocal.push(powerRankingsLocalTemp);
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "I60") {
                            var powerRankingsLocalTemp = {id:14};
                            powerRankingsLocalTemp['top'] = (14-8) * 100;
                            powerRankingsLocalTemp['left'] = 500;
                            powerRankingsLocalTemp['team'] = obj['feed']['entry'][i]['content']['$t'];
                            var lower = obj['feed']['entry'][i]['content']['$t'].toLowerCase();
                            if (teamMap.hasOwnProperty(lower.toLowerCase())) {
                                powerRankingsLocalTemp['logo'] = teamMap[lower]['logo'];
                            }
                            powerRankingsLocal.push(powerRankingsLocalTemp);
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "I61") {
                            var powerRankingsLocalTemp = {id:15};
                            powerRankingsLocalTemp['top'] = (15-8) * 100;
                            powerRankingsLocalTemp['left'] = 500;
                            powerRankingsLocalTemp['team'] = obj['feed']['entry'][i]['content']['$t'];
                            var lower = obj['feed']['entry'][i]['content']['$t'].toLowerCase();
                            if (teamMap.hasOwnProperty(lower.toLowerCase())) {
                                powerRankingsLocalTemp['logo'] = teamMap[lower]['logo'];
                            }
                            powerRankingsLocal.push(powerRankingsLocalTemp);
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "I62") {
                            var powerRankingsLocalTemp = {id:16};
                            powerRankingsLocalTemp['top'] = (16-8) * 100;
                            powerRankingsLocalTemp['left'] = 500;
                            powerRankingsLocalTemp['team'] = obj['feed']['entry'][i]['content']['$t'];
                            var lower = obj['feed']['entry'][i]['content']['$t'].toLowerCase();
                            if (teamMap.hasOwnProperty(lower.toLowerCase())) {
                                powerRankingsLocalTemp['logo'] = teamMap[lower]['logo'];
                            }
                            powerRankingsLocal.push(powerRankingsLocalTemp);
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "F6") {
                            league.set(obj['feed']['entry'][i]['content']['$t']);
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "F7") {
                            currentScene.set(obj['feed']['entry'][i]['content']['$t']);
                            if (obj['feed']['entry'][i]['content']['$t'] == 'caster') {
                              casterDisplay.set(1);
                            } else {
                              casterDisplay.set(0);

                            }
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "N8") {
                            games1['time']=[obj['feed']['entry'][i]['content']['$t'].replace("EST", '')];
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "O8") {
                            games1['league']=[obj['feed']['entry'][i]['content']['$t']];
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "O9") {
                            games1['team1']=[obj['feed']['entry'][i]['content']['$t']];
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "O10") {
                            games1['team2']=[obj['feed']['entry'][i]['content']['$t']];
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "N11") {
                            games2['time']=[obj['feed']['entry'][i]['content']['$t'].replace("EST", '')];
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "O11") {
                            games2['league']=[obj['feed']['entry'][i]['content']['$t']];
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "O12") {
                            games2['team1']=[obj['feed']['entry'][i]['content']['$t']];
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "O13") {
                            games2['team2']=[obj['feed']['entry'][i]['content']['$t']];
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "N14") {
                            games3['time']=[obj['feed']['entry'][i]['content']['$t'].replace("EST", '')];
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "O14") {
                            games3['league']=[obj['feed']['entry'][i]['content']['$t']];
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "O15") {
                            games3['team1']=[obj['feed']['entry'][i]['content']['$t']];
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "O16") {
                            games3['team2']=[obj['feed']['entry'][i]['content']['$t']];
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "N17") {
                            games4['time']=[obj['feed']['entry'][i]['content']['$t'].replace("EST", '')];
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "O17") {
                            games4['league']=[obj['feed']['entry'][i]['content']['$t']];
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "O18") {
                            games4['team1']=[obj['feed']['entry'][i]['content']['$t']];
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "O19") {
                            games4['team2']=[obj['feed']['entry'][i]['content']['$t']];
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "M30") {
                          player1['name']=obj['feed']['entry'][i]['content']['$t'];
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "N30") {
                          if (obj['feed']['entry'][i]['content']['$t'] == ""){
                            player1['goals']=0.00;
                          } else {
                            player1['goals']=obj['feed']['entry'][i]['content']['$t'];
                          }
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "O30") {
                          if (obj['feed']['entry'][i]['content']['$t'] == ""){
                            player1['assists']=0.00;
                          } else {
                            player1['assists']=obj['feed']['entry'][i]['content']['$t'];
                          }
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "P30") {
                          if (obj['feed']['entry'][i]['content']['$t'] == ""){
                            player1['saves']=0.00;
                          } else {
                            player1['saves']=obj['feed']['entry'][i]['content']['$t'];
                          }
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "Q30") {
                          player1['games']=obj['feed']['entry'][i]['content']['$t'];
                        }else if (obj['feed']['entry'][i]['title']['$t'] == "R30") {
                          player1['mmr']=obj['feed']['entry'][i]['content']['$t'];
                        }
                    }
                    games.push(games1);
                    games.push(games2);
                    games.push(games3);
                    games.push(games4);
                    team1.push(player1);
                    console.log(team1);
                    teamPlayers1.set(team1);
                    tickerInfo.set(tickerInfoLocal);
                    powerRankings.set(powerRankingsLocal);
                    tonightGames.set(games);
                }
            };
            xhttp.open("GET", url, true);
            xhttp.send();
        }
        
    }
    setInterval(updateCasters, 5000);
    updateCasters();

    var store = {
    	pbpVideo: pbpVideo.subscribe,
    	colorVideo: colorVideo.subscribe,
    	pbpName: pbpName.subscribe,
    	colorName: colorName.subscribe,
    	pbpImage: pbpImage.subscribe,
    	colorImage: colorImage.subscribe,
    	currentScene: currentScene.subscribe,
    	tickerInfo: tickerInfo.subscribe,
    	powerRankings: powerRankings.subscribe,
    	league: league.subscribe,
    	tonightGames: tonightGames.subscribe,
    	teamPlayers1: teamPlayers1.subscribe,
    	casterDisplay: casterDisplay.subscribe
        
    };

    /* src\Caster.svelte generated by Svelte v3.38.3 */

    const { console: console_1 } = globals;
    const file$9 = "src\\Caster.svelte";

    // (47:4) {#if pbpVideo != 'null'}
    function create_if_block_1$1(ctx) {
    	let div;
    	let iframe;
    	let iframe_src_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			iframe = element("iframe");
    			attr_dev(iframe, "allowtransparency", "true");
    			if (iframe.src !== (iframe_src_value = /*pbpVideo*/ ctx[0])) attr_dev(iframe, "src", iframe_src_value);
    			attr_dev(iframe, "title", "description");
    			attr_dev(iframe, "allow", "autoplay; encrypted-media");
    			attr_dev(iframe, "frameborder", "0");
    			attr_dev(iframe, "class", "svelte-1owfbto");
    			add_location(iframe, file$9, 48, 12, 1344);
    			attr_dev(div, "class", "pbp svelte-1owfbto");
    			add_location(div, file$9, 47, 8, 1313);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, iframe);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*pbpVideo*/ 1 && iframe.src !== (iframe_src_value = /*pbpVideo*/ ctx[0])) {
    				attr_dev(iframe, "src", iframe_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(47:4) {#if pbpVideo != 'null'}",
    		ctx
    	});

    	return block;
    }

    // (53:4) {#if colorVideo != 'null'}
    function create_if_block$3(ctx) {
    	let div;
    	let iframe;
    	let iframe_src_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			iframe = element("iframe");
    			attr_dev(iframe, "allowtransparency", "true");
    			if (iframe.src !== (iframe_src_value = /*colorVideo*/ ctx[1])) attr_dev(iframe, "src", iframe_src_value);
    			attr_dev(iframe, "title", "description");
    			attr_dev(iframe, "allow", "autoplay; encrypted-media");
    			attr_dev(iframe, "frameborder", "0");
    			attr_dev(iframe, "class", "svelte-1owfbto");
    			add_location(iframe, file$9, 54, 12, 1581);
    			attr_dev(div, "class", "color svelte-1owfbto");
    			add_location(div, file$9, 53, 8, 1548);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, iframe);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*colorVideo*/ 2 && iframe.src !== (iframe_src_value = /*colorVideo*/ ctx[1])) {
    				attr_dev(iframe, "src", iframe_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(53:4) {#if colorVideo != 'null'}",
    		ctx
    	});

    	return block;
    }

    // (1:0)   <script>   import { fade }
    function create_catch_block_1(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block_1.name,
    		type: "catch",
    		source: "(1:0)   <script>   import { fade }",
    		ctx
    	});

    	return block;
    }

    // (58:37)           <div class='pbp2' transition:fade="{{ duration:3000 }}
    function create_then_block_1(ctx) {
    	let div1;
    	let img;
    	let img_src_value;
    	let t0;
    	let div0;
    	let t1;
    	let div1_transition;
    	let current;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			img = element("img");
    			t0 = space();
    			div0 = element("div");
    			t1 = text(/*pbpName*/ ctx[2]);
    			if (img.src !== (img_src_value = /*pbpImage*/ ctx[4])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "pbp");
    			attr_dev(img, "class", "svelte-1owfbto");
    			add_location(img, file$9, 59, 12, 1858);
    			attr_dev(div0, "class", "pName svelte-1owfbto");
    			add_location(div0, file$9, 60, 12, 1904);
    			attr_dev(div1, "class", "pbp2 svelte-1owfbto");
    			add_location(div1, file$9, 58, 8, 1788);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, img);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			append_dev(div0, t1);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty & /*pbpImage*/ 16 && img.src !== (img_src_value = /*pbpImage*/ ctx[4])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (!current || dirty & /*pbpName*/ 4) set_data_dev(t1, /*pbpName*/ ctx[2]);
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div1_transition) div1_transition = create_bidirectional_transition(div1, fade, { duration: 3000 }, true);
    				div1_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div1_transition) div1_transition = create_bidirectional_transition(div1, fade, { duration: 3000 }, false);
    			div1_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (detaching && div1_transition) div1_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block_1.name,
    		type: "then",
    		source: "(58:37)           <div class='pbp2' transition:fade=\\\"{{ duration:3000 }}",
    		ctx
    	});

    	return block;
    }

    // (1:0)   <script>   import { fade }
    function create_pending_block_1(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block_1.name,
    		type: "pending",
    		source: "(1:0)   <script>   import { fade }",
    		ctx
    	});

    	return block;
    }

    // (1:0)   <script>   import { fade }
    function create_catch_block$1(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block$1.name,
    		type: "catch",
    		source: "(1:0)   <script>   import { fade }",
    		ctx
    	});

    	return block;
    }

    // (64:39)           <div class='color2' transition:fade="{{ duration:3000 }}
    function create_then_block$1(ctx) {
    	let div1;
    	let img;
    	let img_src_value;
    	let t0;
    	let div0;
    	let t1;
    	let div1_transition;
    	let current;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			img = element("img");
    			t0 = space();
    			div0 = element("div");
    			t1 = text(/*colorName*/ ctx[3]);
    			if (img.src !== (img_src_value = /*colorImage*/ ctx[5])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "color");
    			attr_dev(img, "class", "svelte-1owfbto");
    			add_location(img, file$9, 65, 12, 2091);
    			attr_dev(div0, "class", "pName svelte-1owfbto");
    			add_location(div0, file$9, 66, 12, 2141);
    			attr_dev(div1, "class", "color2 svelte-1owfbto");
    			add_location(div1, file$9, 64, 8, 2019);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, img);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			append_dev(div0, t1);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty & /*colorImage*/ 32 && img.src !== (img_src_value = /*colorImage*/ ctx[5])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (!current || dirty & /*colorName*/ 8) set_data_dev(t1, /*colorName*/ ctx[3]);
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div1_transition) div1_transition = create_bidirectional_transition(div1, fade, { duration: 3000 }, true);
    				div1_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div1_transition) div1_transition = create_bidirectional_transition(div1, fade, { duration: 3000 }, false);
    			div1_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (detaching && div1_transition) div1_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block$1.name,
    		type: "then",
    		source: "(64:39)           <div class='color2' transition:fade=\\\"{{ duration:3000 }}",
    		ctx
    	});

    	return block;
    }

    // (1:0)   <script>   import { fade }
    function create_pending_block$1(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block$1.name,
    		type: "pending",
    		source: "(1:0)   <script>   import { fade }",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let div1;
    	let div0;
    	let img;
    	let img_src_value;
    	let t0;
    	let t1;
    	let t2;
    	let promise;
    	let t3;
    	let promise_1;
    	let current;
    	let if_block0 = /*pbpVideo*/ ctx[0] != "null" && create_if_block_1$1(ctx);
    	let if_block1 = /*colorVideo*/ ctx[1] != "null" && create_if_block$3(ctx);

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block_1,
    		then: create_then_block_1,
    		catch: create_catch_block_1,
    		value: 6,
    		blocks: [,,,]
    	};

    	handle_promise(promise = preload$1(/*pbpImage*/ ctx[4]), info);

    	let info_1 = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block$1,
    		then: create_then_block$1,
    		catch: create_catch_block$1,
    		value: 6,
    		blocks: [,,,]
    	};

    	handle_promise(promise_1 = preload$1(/*colorImage*/ ctx[5]), info_1);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			img = element("img");
    			t0 = space();
    			if (if_block0) if_block0.c();
    			t1 = space();
    			if (if_block1) if_block1.c();
    			t2 = space();
    			info.block.c();
    			t3 = space();
    			info_1.block.c();
    			if (img.src !== (img_src_value = "https://media.discordapp.net/attachments/804171789101432832/845380799498944532/playoff2split.png?width=1920&height=1080")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "background");
    			add_location(img, file$9, 43, 8, 1107);
    			attr_dev(div0, "class", "background svelte-1owfbto");
    			add_location(div0, file$9, 42, 4, 1073);
    			attr_dev(div1, "class", "container svelte-1owfbto");
    			add_location(div1, file$9, 41, 0, 1044);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, img);
    			append_dev(div1, t0);
    			if (if_block0) if_block0.m(div1, null);
    			append_dev(div1, t1);
    			if (if_block1) if_block1.m(div1, null);
    			append_dev(div1, t2);
    			info.block.m(div1, info.anchor = null);
    			info.mount = () => div1;
    			info.anchor = t3;
    			append_dev(div1, t3);
    			info_1.block.m(div1, info_1.anchor = null);
    			info_1.mount = () => div1;
    			info_1.anchor = null;
    			current = true;
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;

    			if (/*pbpVideo*/ ctx[0] != "null") {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_1$1(ctx);
    					if_block0.c();
    					if_block0.m(div1, t1);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*colorVideo*/ ctx[1] != "null") {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block$3(ctx);
    					if_block1.c();
    					if_block1.m(div1, t2);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			info.ctx = ctx;

    			if (dirty & /*pbpImage*/ 16 && promise !== (promise = preload$1(/*pbpImage*/ ctx[4])) && handle_promise(promise, info)) ; else {
    				update_await_block_branch(info, ctx, dirty);
    			}

    			info_1.ctx = ctx;

    			if (dirty & /*colorImage*/ 32 && promise_1 !== (promise_1 = preload$1(/*colorImage*/ ctx[5])) && handle_promise(promise_1, info_1)) ; else {
    				update_await_block_branch(info_1, ctx, dirty);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(info.block);
    			transition_in(info_1.block);
    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < 3; i += 1) {
    				const block = info.blocks[i];
    				transition_out(block);
    			}

    			for (let i = 0; i < 3; i += 1) {
    				const block = info_1.blocks[i];
    				transition_out(block);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			info.block.d();
    			info.token = null;
    			info = null;
    			info_1.block.d();
    			info_1.token = null;
    			info_1 = null;
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function preload$1(src) {
    	return new Promise(function (resolve) {
    			let img = new Image();
    			img.onload = resolve;
    			img.src = src;
    		});
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Caster", slots, []);
    	let pbpVideo;
    	let colorVideo;
    	let pbpName;
    	let colorName;
    	let pbpImage;
    	let colorImage;

    	onMount(() => {
    		store.pbpVideo(currentMessage => {
    			$$invalidate(0, pbpVideo = currentMessage);
    			console.log(pbpVideo);
    		});

    		store.colorVideo(currentMessage => {
    			$$invalidate(1, colorVideo = currentMessage);
    			console.log(colorVideo);
    		});

    		store.pbpName(currentMessage => {
    			$$invalidate(2, pbpName = currentMessage.toUpperCase());
    		});

    		store.colorName(currentMessage => {
    			$$invalidate(3, colorName = currentMessage.toUpperCase());
    		});

    		store.pbpImage(currentMessage => {
    			$$invalidate(4, pbpImage = currentMessage);
    		});

    		store.colorImage(currentMessage => {
    			$$invalidate(5, colorImage = currentMessage);
    		});
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Caster> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		fade,
    		onMount,
    		pbpVideo,
    		colorVideo,
    		pbpName,
    		colorName,
    		pbpImage,
    		colorImage,
    		store,
    		preload: preload$1
    	});

    	$$self.$inject_state = $$props => {
    		if ("pbpVideo" in $$props) $$invalidate(0, pbpVideo = $$props.pbpVideo);
    		if ("colorVideo" in $$props) $$invalidate(1, colorVideo = $$props.colorVideo);
    		if ("pbpName" in $$props) $$invalidate(2, pbpName = $$props.pbpName);
    		if ("colorName" in $$props) $$invalidate(3, colorName = $$props.colorName);
    		if ("pbpImage" in $$props) $$invalidate(4, pbpImage = $$props.pbpImage);
    		if ("colorImage" in $$props) $$invalidate(5, colorImage = $$props.colorImage);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [pbpVideo, colorVideo, pbpName, colorName, pbpImage, colorImage];
    }

    class Caster extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Caster",
    			options,
    			id: create_fragment$9.name
    		});
    	}
    }

    /* src\Ticker.svelte generated by Svelte v3.38.3 */
    const file$8 = "src\\Ticker.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[23] = list[i];
    	return child_ctx;
    }

    // (13:7) Ticker default content
    function fallback_block(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Ticker default content");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: fallback_block.name,
    		type: "fallback",
    		source: "(13:7) Ticker default content",
    		ctx
    	});

    	return block;
    }

    // (12:0) {#each Array(1 + rags) as _}
    function create_each_block$3(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[20].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[19], null);
    	const default_slot_or_fallback = default_slot || fallback_block(ctx);

    	const block = {
    		c: function create() {
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 524288)) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[19], !current ? -1 : dirty, null, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(12:0) {#each Array(1 + rags) as _}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
    	let div;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = Array(1 + /*rags*/ ctx[9]);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			set_style(div, "animation-duration", /*duration*/ ctx[1] + "s");
    			set_style(div, "animation-delay", /*delay*/ ctx[2] + "s");
    			set_style(div, "animation-iteration-count", /*iterations*/ ctx[7]);
    			set_style(div, "animation-direction", /*dir*/ ctx[8]);
    			attr_dev(div, "class", "svelte-l974z0");
    			toggle_class(div, "animate", /*animate*/ ctx[3]);
    			toggle_class(div, "horizontal", /*horizontal*/ ctx[4]);
    			toggle_class(div, "vertical", /*vertical*/ ctx[6]);
    			toggle_class(div, "pausing", /*pausing*/ ctx[0]);
    			add_location(div, file$8, 2, 0, 40);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			/*div_binding*/ ctx[21](div);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(window, "resize", /*sizing*/ ctx[10], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*$$scope, rags*/ 524800) {
    				each_value = Array(1 + /*rags*/ ctx[9]);
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (!current || dirty & /*duration*/ 2) {
    				set_style(div, "animation-duration", /*duration*/ ctx[1] + "s");
    			}

    			if (!current || dirty & /*delay*/ 4) {
    				set_style(div, "animation-delay", /*delay*/ ctx[2] + "s");
    			}

    			if (!current || dirty & /*iterations*/ 128) {
    				set_style(div, "animation-iteration-count", /*iterations*/ ctx[7]);
    			}

    			if (!current || dirty & /*dir*/ 256) {
    				set_style(div, "animation-direction", /*dir*/ ctx[8]);
    			}

    			if (dirty & /*animate*/ 8) {
    				toggle_class(div, "animate", /*animate*/ ctx[3]);
    			}

    			if (dirty & /*horizontal*/ 16) {
    				toggle_class(div, "horizontal", /*horizontal*/ ctx[4]);
    			}

    			if (dirty & /*vertical*/ 64) {
    				toggle_class(div, "vertical", /*vertical*/ ctx[6]);
    			}

    			if (dirty & /*pausing*/ 1) {
    				toggle_class(div, "pausing", /*pausing*/ ctx[0]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    			/*div_binding*/ ctx[21](null);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let reverse;
    	let horizontal;
    	let vertical;
    	let measure;
    	let iterations;
    	let dir;
    	let ext;
    	let rags;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Ticker", slots, ['default']);

    	let { direction = "left" } = $$props,
    		{ alternate = false } = $$props,
    		{ behavior = "auto" } = $$props,
    		animate = false,
    		{ pausing = true } = $$props,
    		{ duration = 30 } = $$props,
    		{ loop = true } = $$props,
    		{ delay = 0 } = $$props,
    		parentSize,
    		size,
    		self; // right, top, bottom
    	// always
    	// sec
    	// false || float
    	// sec

    	function sizing() {
    		(!rags || !size) && $$invalidate(16, size = self[measure]);
    		$$invalidate(15, parentSize = self.parentNode[measure]);
    		$$invalidate(3, animate = behavior === "always" || size > parentSize);
    	}

    	onMount(sizing);
    	const writable_props = ["direction", "alternate", "behavior", "pausing", "duration", "loop", "delay"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Ticker> was created with unknown prop '${key}'`);
    	});

    	function div_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			self = $$value;
    			$$invalidate(5, self);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ("direction" in $$props) $$invalidate(11, direction = $$props.direction);
    		if ("alternate" in $$props) $$invalidate(12, alternate = $$props.alternate);
    		if ("behavior" in $$props) $$invalidate(13, behavior = $$props.behavior);
    		if ("pausing" in $$props) $$invalidate(0, pausing = $$props.pausing);
    		if ("duration" in $$props) $$invalidate(1, duration = $$props.duration);
    		if ("loop" in $$props) $$invalidate(14, loop = $$props.loop);
    		if ("delay" in $$props) $$invalidate(2, delay = $$props.delay);
    		if ("$$scope" in $$props) $$invalidate(19, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		direction,
    		alternate,
    		behavior,
    		animate,
    		pausing,
    		duration,
    		loop,
    		delay,
    		parentSize,
    		size,
    		self,
    		sizing,
    		reverse,
    		horizontal,
    		vertical,
    		measure,
    		iterations,
    		dir,
    		ext,
    		rags
    	});

    	$$self.$inject_state = $$props => {
    		if ("direction" in $$props) $$invalidate(11, direction = $$props.direction);
    		if ("alternate" in $$props) $$invalidate(12, alternate = $$props.alternate);
    		if ("behavior" in $$props) $$invalidate(13, behavior = $$props.behavior);
    		if ("animate" in $$props) $$invalidate(3, animate = $$props.animate);
    		if ("pausing" in $$props) $$invalidate(0, pausing = $$props.pausing);
    		if ("duration" in $$props) $$invalidate(1, duration = $$props.duration);
    		if ("loop" in $$props) $$invalidate(14, loop = $$props.loop);
    		if ("delay" in $$props) $$invalidate(2, delay = $$props.delay);
    		if ("parentSize" in $$props) $$invalidate(15, parentSize = $$props.parentSize);
    		if ("size" in $$props) $$invalidate(16, size = $$props.size);
    		if ("self" in $$props) $$invalidate(5, self = $$props.self);
    		if ("reverse" in $$props) $$invalidate(17, reverse = $$props.reverse);
    		if ("horizontal" in $$props) $$invalidate(4, horizontal = $$props.horizontal);
    		if ("vertical" in $$props) $$invalidate(6, vertical = $$props.vertical);
    		if ("measure" in $$props) measure = $$props.measure;
    		if ("iterations" in $$props) $$invalidate(7, iterations = $$props.iterations);
    		if ("dir" in $$props) $$invalidate(8, dir = $$props.dir);
    		if ("ext" in $$props) $$invalidate(18, ext = $$props.ext);
    		if ("rags" in $$props) $$invalidate(9, rags = $$props.rags);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*direction*/ 2048) {
    			$$invalidate(17, reverse = direction === "right" || direction === "bottom");
    		}

    		if ($$self.$$.dirty & /*direction*/ 2048) {
    			$$invalidate(4, horizontal = direction === "left" || direction === "right");
    		}

    		if ($$self.$$.dirty & /*horizontal*/ 16) {
    			$$invalidate(6, vertical = !horizontal);
    		}

    		if ($$self.$$.dirty & /*horizontal*/ 16) {
    			measure = horizontal ? "clientWidth" : "clientHeight";
    		}

    		if ($$self.$$.dirty & /*loop*/ 16384) {
    			$$invalidate(7, iterations = typeof loop === "number" ? loop : loop ? "infinite" : 1);
    		}

    		if ($$self.$$.dirty & /*reverse, alternate*/ 135168) {
    			$$invalidate(8, dir = reverse
    			? alternate ? "alternate-reverse" : "reverse"
    			: alternate ? "alternate" : "normal");
    		}

    		if ($$self.$$.dirty & /*behavior, parentSize, size*/ 106496) {
    			$$invalidate(18, ext = behavior === "always" && parentSize > size
    			? Math.ceil(parentSize / size)
    			: 0);
    		}

    		if ($$self.$$.dirty & /*ext, animate, loop, alternate*/ 282632) {
    			$$invalidate(9, rags = ext + (animate && loop && !alternate));
    		}
    	};

    	return [
    		pausing,
    		duration,
    		delay,
    		animate,
    		horizontal,
    		self,
    		vertical,
    		iterations,
    		dir,
    		rags,
    		sizing,
    		direction,
    		alternate,
    		behavior,
    		loop,
    		parentSize,
    		size,
    		reverse,
    		ext,
    		$$scope,
    		slots,
    		div_binding
    	];
    }

    class Ticker extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {
    			direction: 11,
    			alternate: 12,
    			behavior: 13,
    			pausing: 0,
    			duration: 1,
    			loop: 14,
    			delay: 2
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Ticker",
    			options,
    			id: create_fragment$8.name
    		});
    	}

    	get direction() {
    		throw new Error("<Ticker>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set direction(value) {
    		throw new Error("<Ticker>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get alternate() {
    		throw new Error("<Ticker>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set alternate(value) {
    		throw new Error("<Ticker>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get behavior() {
    		throw new Error("<Ticker>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set behavior(value) {
    		throw new Error("<Ticker>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get pausing() {
    		throw new Error("<Ticker>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set pausing(value) {
    		throw new Error("<Ticker>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get duration() {
    		throw new Error("<Ticker>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set duration(value) {
    		throw new Error("<Ticker>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get loop() {
    		throw new Error("<Ticker>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set loop(value) {
    		throw new Error("<Ticker>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get delay() {
    		throw new Error("<Ticker>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set delay(value) {
    		throw new Error("<Ticker>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\GameDesk.svelte generated by Svelte v3.38.3 */

    const file$7 = "src\\GameDesk.svelte";

    // (9:0) {#if time != ''}
    function create_if_block$2(ctx) {
    	let div;
    	let p0;
    	let t0;
    	let t1;
    	let p1;
    	let t2;
    	let t3;
    	let p2;
    	let t4;
    	let t5;
    	let p3;
    	let t7;
    	let p4;
    	let t8;

    	const block = {
    		c: function create() {
    			div = element("div");
    			p0 = element("p");
    			t0 = text(/*time*/ ctx[0]);
    			t1 = space();
    			p1 = element("p");
    			t2 = text(/*league*/ ctx[1]);
    			t3 = space();
    			p2 = element("p");
    			t4 = text(/*team1*/ ctx[2]);
    			t5 = space();
    			p3 = element("p");
    			p3.textContent = "VS";
    			t7 = space();
    			p4 = element("p");
    			t8 = text(/*team2*/ ctx[3]);
    			attr_dev(p0, "class", "time svelte-1cnf5jy");
    			add_location(p0, file$7, 10, 4, 218);
    			attr_dev(p1, "class", "league svelte-1cnf5jy");
    			add_location(p1, file$7, 11, 4, 249);
    			attr_dev(p2, "class", "team1 svelte-1cnf5jy");
    			add_location(p2, file$7, 12, 4, 284);
    			attr_dev(p3, "class", "vs svelte-1cnf5jy");
    			add_location(p3, file$7, 13, 4, 317);
    			attr_dev(p4, "class", "team2 svelte-1cnf5jy");
    			add_location(p4, file$7, 14, 4, 342);
    			attr_dev(div, "class", "container svelte-1cnf5jy");
    			set_style(div, "top", /*top*/ ctx[4] + "px");
    			add_location(div, file$7, 9, 0, 170);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, p0);
    			append_dev(p0, t0);
    			append_dev(div, t1);
    			append_dev(div, p1);
    			append_dev(p1, t2);
    			append_dev(div, t3);
    			append_dev(div, p2);
    			append_dev(p2, t4);
    			append_dev(div, t5);
    			append_dev(div, p3);
    			append_dev(div, t7);
    			append_dev(div, p4);
    			append_dev(p4, t8);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*time*/ 1) set_data_dev(t0, /*time*/ ctx[0]);
    			if (dirty & /*league*/ 2) set_data_dev(t2, /*league*/ ctx[1]);
    			if (dirty & /*team1*/ 4) set_data_dev(t4, /*team1*/ ctx[2]);
    			if (dirty & /*team2*/ 8) set_data_dev(t8, /*team2*/ ctx[3]);

    			if (dirty & /*top*/ 16) {
    				set_style(div, "top", /*top*/ ctx[4] + "px");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(9:0) {#if time != ''}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let if_block_anchor;
    	let if_block = /*time*/ ctx[0] != "" && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*time*/ ctx[0] != "") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("GameDesk", slots, []);
    	let { time = "" } = $$props;
    	let { league = "" } = $$props;
    	let { team1 = "" } = $$props;
    	let { team2 = "" } = $$props;
    	let { top = "" } = $$props;
    	const writable_props = ["time", "league", "team1", "team2", "top"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<GameDesk> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("time" in $$props) $$invalidate(0, time = $$props.time);
    		if ("league" in $$props) $$invalidate(1, league = $$props.league);
    		if ("team1" in $$props) $$invalidate(2, team1 = $$props.team1);
    		if ("team2" in $$props) $$invalidate(3, team2 = $$props.team2);
    		if ("top" in $$props) $$invalidate(4, top = $$props.top);
    	};

    	$$self.$capture_state = () => ({ time, league, team1, team2, top });

    	$$self.$inject_state = $$props => {
    		if ("time" in $$props) $$invalidate(0, time = $$props.time);
    		if ("league" in $$props) $$invalidate(1, league = $$props.league);
    		if ("team1" in $$props) $$invalidate(2, team1 = $$props.team1);
    		if ("team2" in $$props) $$invalidate(3, team2 = $$props.team2);
    		if ("top" in $$props) $$invalidate(4, top = $$props.top);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [time, league, team1, team2, top];
    }

    class GameDesk extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {
    			time: 0,
    			league: 1,
    			team1: 2,
    			team2: 3,
    			top: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "GameDesk",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get time() {
    		throw new Error("<GameDesk>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set time(value) {
    		throw new Error("<GameDesk>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get league() {
    		throw new Error("<GameDesk>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set league(value) {
    		throw new Error("<GameDesk>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get team1() {
    		throw new Error("<GameDesk>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team1(value) {
    		throw new Error("<GameDesk>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get team2() {
    		throw new Error("<GameDesk>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team2(value) {
    		throw new Error("<GameDesk>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get top() {
    		throw new Error("<GameDesk>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set top(value) {
    		throw new Error("<GameDesk>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Desk.svelte generated by Svelte v3.38.3 */
    const file$6 = "src\\Desk.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i];
    	return child_ctx;
    }

    // (32:4) {#each tonightGames as game (game.time)}
    function create_each_block$2(key_1, ctx) {
    	let first;
    	let gamedesk;
    	let current;

    	gamedesk = new GameDesk({
    			props: {
    				time: /*game*/ ctx[3].time,
    				league: /*game*/ ctx[3].league,
    				team1: /*game*/ ctx[3].team1,
    				team2: /*game*/ ctx[3].team2,
    				top: /*game*/ ctx[3].top
    			},
    			$$inline: true
    		});

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(gamedesk.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(gamedesk, target, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			const gamedesk_changes = {};
    			if (dirty & /*tonightGames*/ 2) gamedesk_changes.time = /*game*/ ctx[3].time;
    			if (dirty & /*tonightGames*/ 2) gamedesk_changes.league = /*game*/ ctx[3].league;
    			if (dirty & /*tonightGames*/ 2) gamedesk_changes.team1 = /*game*/ ctx[3].team1;
    			if (dirty & /*tonightGames*/ 2) gamedesk_changes.team2 = /*game*/ ctx[3].team2;
    			if (dirty & /*tonightGames*/ 2) gamedesk_changes.top = /*game*/ ctx[3].top;
    			gamedesk.$set(gamedesk_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(gamedesk.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(gamedesk.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(gamedesk, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(32:4) {#each tonightGames as game (game.time)}",
    		ctx
    	});

    	return block;
    }

    // (36:8) {#if tickerInfo != ''}
    function create_if_block$1(ctx) {
    	let ticker;
    	let current;

    	ticker = new Ticker({
    			props: {
    				behavior: "always",
    				duration: "120",
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(ticker.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(ticker, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const ticker_changes = {};

    			if (dirty & /*$$scope, tickerInfo*/ 65) {
    				ticker_changes.$$scope = { dirty, ctx };
    			}

    			ticker.$set(ticker_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(ticker.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(ticker.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(ticker, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(36:8) {#if tickerInfo != ''}",
    		ctx
    	});

    	return block;
    }

    // (37:12) <Ticker behavior='always' duration=120>
    function create_default_slot(ctx) {
    	let html_tag;
    	let html_anchor;

    	const block = {
    		c: function create() {
    			html_tag = new HtmlTag();
    			html_anchor = empty();
    			html_tag.a = html_anchor;
    		},
    		m: function mount(target, anchor) {
    			html_tag.m(/*tickerInfo*/ ctx[0], target, anchor);
    			insert_dev(target, html_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*tickerInfo*/ 1) html_tag.p(/*tickerInfo*/ ctx[0]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(html_anchor);
    			if (detaching) html_tag.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(37:12) <Ticker behavior='always' duration=120>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let div1;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t;
    	let div0;
    	let div1_transition;
    	let current;
    	let each_value = /*tonightGames*/ ctx[1];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*game*/ ctx[3].time;
    	validate_each_keys(ctx, each_value, get_each_context$2, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$2(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$2(key, child_ctx));
    	}

    	let if_block = /*tickerInfo*/ ctx[0] != "" && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			div0 = element("div");
    			if (if_block) if_block.c();
    			attr_dev(div0, "class", "ticker svelte-1ah20to");
    			add_location(div0, file$6, 34, 4, 951);
    			attr_dev(div1, "class", "container svelte-1ah20to");
    			add_location(div1, file$6, 30, 0, 692);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

    			append_dev(div1, t);
    			append_dev(div1, div0);
    			if (if_block) if_block.m(div0, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*tonightGames*/ 2) {
    				each_value = /*tonightGames*/ ctx[1];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context$2, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div1, outro_and_destroy_block, create_each_block$2, t, get_each_context$2);
    				check_outros();
    			}

    			if (/*tickerInfo*/ ctx[0] != "") {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*tickerInfo*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div0, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			transition_in(if_block);

    			add_render_callback(() => {
    				if (!div1_transition) div1_transition = create_bidirectional_transition(
    					div1,
    					fade,
    					{
    						delay: 1500,
    						duration: 1000,
    						ease: "circ"
    					},
    					true
    				);

    				div1_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			transition_out(if_block);

    			if (!div1_transition) div1_transition = create_bidirectional_transition(
    				div1,
    				fade,
    				{
    					delay: 1500,
    					duration: 1000,
    					ease: "circ"
    				},
    				false
    			);

    			div1_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			if (if_block) if_block.d();
    			if (detaching && div1_transition) div1_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Desk", slots, []);
    	let { tickerInfo = "" } = $$props;
    	let { tonightGames = [] } = $$props;

    	onMount(() => {
    		store.tickerInfo(currentMessage => {
    			$$invalidate(0, tickerInfo = currentMessage);
    		});

    		store.tonightGames(currentMessage => {
    			$$invalidate(1, tonightGames = currentMessage);
    		});
    	});

    	let props = {
    		direction: ["left", ["left", "right", "top", "bottom"]],
    		duration: 30,
    		delay: 0,
    		loop: true,
    		pausing: true,
    		alternate: false,
    		behavior: ["auto", ["auto", "always"]]
    	};

    	const writable_props = ["tickerInfo", "tonightGames"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Desk> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("tickerInfo" in $$props) $$invalidate(0, tickerInfo = $$props.tickerInfo);
    		if ("tonightGames" in $$props) $$invalidate(1, tonightGames = $$props.tonightGames);
    	};

    	$$self.$capture_state = () => ({
    		fade,
    		Ticker,
    		GameDesk,
    		store,
    		onMount,
    		tickerInfo,
    		tonightGames,
    		props
    	});

    	$$self.$inject_state = $$props => {
    		if ("tickerInfo" in $$props) $$invalidate(0, tickerInfo = $$props.tickerInfo);
    		if ("tonightGames" in $$props) $$invalidate(1, tonightGames = $$props.tonightGames);
    		if ("props" in $$props) props = $$props.props;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [tickerInfo, tonightGames];
    }

    class Desk extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { tickerInfo: 0, tonightGames: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Desk",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get tickerInfo() {
    		throw new Error("<Desk>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set tickerInfo(value) {
    		throw new Error("<Desk>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get tonightGames() {
    		throw new Error("<Desk>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set tonightGames(value) {
    		throw new Error("<Desk>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\TeamPR.svelte generated by Svelte v3.38.3 */
    const file$5 = "src\\TeamPR.svelte";

    // (1:0) <script>      import { fade }
    function create_catch_block(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block.name,
    		type: "catch",
    		source: "(1:0) <script>      import { fade }",
    		ctx
    	});

    	return block;
    }

    // (23:29)       <div class='team' style="top:{top}
    function create_then_block(ctx) {
    	let div;
    	let p0;
    	let t0;
    	let t1;
    	let img;
    	let img_src_value;
    	let t2;
    	let p1;
    	let t3;
    	let div_transition;
    	let current;

    	const block = {
    		c: function create() {
    			div = element("div");
    			p0 = element("p");
    			t0 = text(/*team*/ ctx[0]);
    			t1 = space();
    			img = element("img");
    			t2 = space();
    			p1 = element("p");
    			t3 = text(/*standing*/ ctx[2]);
    			attr_dev(p0, "class", "name svelte-1g28eke");
    			add_location(p0, file$5, 24, 8, 703);
    			if (img.src !== (img_src_value = /*logo*/ ctx[1])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "team");
    			attr_dev(img, "class", "svelte-1g28eke");
    			add_location(img, file$5, 25, 8, 739);
    			attr_dev(p1, "class", "place svelte-1g28eke");
    			add_location(p1, file$5, 26, 8, 776);
    			attr_dev(div, "class", "team svelte-1g28eke");
    			set_style(div, "top", /*top*/ ctx[3] + "px");
    			set_style(div, "background-color", /*color*/ ctx[5]);
    			set_style(div, "left", /*left*/ ctx[4] + "px");
    			add_location(div, file$5, 23, 4, 560);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, p0);
    			append_dev(p0, t0);
    			append_dev(div, t1);
    			append_dev(div, img);
    			append_dev(div, t2);
    			append_dev(div, p1);
    			append_dev(p1, t3);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty & /*team*/ 1) set_data_dev(t0, /*team*/ ctx[0]);

    			if (!current || dirty & /*logo*/ 2 && img.src !== (img_src_value = /*logo*/ ctx[1])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (!current || dirty & /*standing*/ 4) set_data_dev(t3, /*standing*/ ctx[2]);

    			if (!current || dirty & /*top*/ 8) {
    				set_style(div, "top", /*top*/ ctx[3] + "px");
    			}

    			if (!current || dirty & /*color*/ 32) {
    				set_style(div, "background-color", /*color*/ ctx[5]);
    			}

    			if (!current || dirty & /*left*/ 16) {
    				set_style(div, "left", /*left*/ ctx[4] + "px");
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { duration: 3000, ease: "circ" }, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { duration: 3000, ease: "circ" }, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching && div_transition) div_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block.name,
    		type: "then",
    		source: "(23:29)       <div class='team' style=\\\"top:{top}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>      import { fade }
    function create_pending_block(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block.name,
    		type: "pending",
    		source: "(1:0) <script>      import { fade }",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let await_block_anchor;
    	let promise;
    	let current;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block,
    		then: create_then_block,
    		catch: create_catch_block,
    		value: 6,
    		blocks: [,,,]
    	};

    	handle_promise(promise = preload(/*logo*/ ctx[1]), info);

    	const block = {
    		c: function create() {
    			await_block_anchor = empty();
    			info.block.c();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, await_block_anchor, anchor);
    			info.block.m(target, info.anchor = anchor);
    			info.mount = () => await_block_anchor.parentNode;
    			info.anchor = await_block_anchor;
    			current = true;
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			info.ctx = ctx;

    			if (dirty & /*logo*/ 2 && promise !== (promise = preload(/*logo*/ ctx[1])) && handle_promise(promise, info)) ; else {
    				update_await_block_branch(info, ctx, dirty);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(info.block);
    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < 3; i += 1) {
    				const block = info.blocks[i];
    				transition_out(block);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(await_block_anchor);
    			info.block.d(detaching);
    			info.token = null;
    			info = null;
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function preload(src) {
    	return new Promise(function (resolve) {
    			let img = new Image();
    			img.onload = resolve;
    			img.src = src;
    		});
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("TeamPR", slots, []);
    	let { team = "" } = $$props;
    	let { logo = "" } = $$props;
    	let { standing = "" } = $$props;
    	let { top = 0 } = $$props;
    	let { left = 0 } = $$props;
    	let color = "";

    	if (top / 100 % 2 == 0) {
    		color = "#1c1c1c";
    	} else {
    		color = "#a3141b";
    	}

    	const writable_props = ["team", "logo", "standing", "top", "left"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<TeamPR> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("team" in $$props) $$invalidate(0, team = $$props.team);
    		if ("logo" in $$props) $$invalidate(1, logo = $$props.logo);
    		if ("standing" in $$props) $$invalidate(2, standing = $$props.standing);
    		if ("top" in $$props) $$invalidate(3, top = $$props.top);
    		if ("left" in $$props) $$invalidate(4, left = $$props.left);
    	};

    	$$self.$capture_state = () => ({
    		fade,
    		team,
    		logo,
    		standing,
    		top,
    		left,
    		color,
    		preload
    	});

    	$$self.$inject_state = $$props => {
    		if ("team" in $$props) $$invalidate(0, team = $$props.team);
    		if ("logo" in $$props) $$invalidate(1, logo = $$props.logo);
    		if ("standing" in $$props) $$invalidate(2, standing = $$props.standing);
    		if ("top" in $$props) $$invalidate(3, top = $$props.top);
    		if ("left" in $$props) $$invalidate(4, left = $$props.left);
    		if ("color" in $$props) $$invalidate(5, color = $$props.color);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [team, logo, standing, top, left, color];
    }

    class TeamPR extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {
    			team: 0,
    			logo: 1,
    			standing: 2,
    			top: 3,
    			left: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TeamPR",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get team() {
    		throw new Error("<TeamPR>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set team(value) {
    		throw new Error("<TeamPR>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get logo() {
    		throw new Error("<TeamPR>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set logo(value) {
    		throw new Error("<TeamPR>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get standing() {
    		throw new Error("<TeamPR>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set standing(value) {
    		throw new Error("<TeamPR>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get top() {
    		throw new Error("<TeamPR>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set top(value) {
    		throw new Error("<TeamPR>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get left() {
    		throw new Error("<TeamPR>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set left(value) {
    		throw new Error("<TeamPR>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /*!
     * html2canvas 1.1.4 <https://html2canvas.hertzen.com>
     * Copyright (c) 2021 Niklas von Hertzen <https://hertzen.com>
     * Released under MIT License
     */

    var html2canvas = createCommonjsModule(function (module, exports) {
    (function (global, factory) {
        module.exports = factory() ;
    }(commonjsGlobal, (function () {
        /*! *****************************************************************************
        Copyright (c) Microsoft Corporation.

        Permission to use, copy, modify, and/or distribute this software for any
        purpose with or without fee is hereby granted.

        THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
        REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
        AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
        INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
        LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
        OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
        PERFORMANCE OF THIS SOFTWARE.
        ***************************************************************************** */
        /* global Reflect, Promise */

        var extendStatics = function(d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };

        function __extends(d, b) {
            if (typeof b !== "function" && b !== null)
                throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        }

        var __assign = function() {
            __assign = Object.assign || function __assign(t) {
                for (var s, i = 1, n = arguments.length; i < n; i++) {
                    s = arguments[i];
                    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
                }
                return t;
            };
            return __assign.apply(this, arguments);
        };

        function __awaiter(thisArg, _arguments, P, generator) {
            function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
            return new (P || (P = Promise))(function (resolve, reject) {
                function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
                function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
                function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
                step((generator = generator.apply(thisArg, _arguments || [])).next());
            });
        }

        function __generator(thisArg, body) {
            var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
            return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
            function verb(n) { return function (v) { return step([n, v]); }; }
            function step(op) {
                if (f) throw new TypeError("Generator is already executing.");
                while (_) try {
                    if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                    if (y = 0, t) op = [op[0] & 2, t.value];
                    switch (op[0]) {
                        case 0: case 1: t = op; break;
                        case 4: _.label++; return { value: op[1], done: false };
                        case 5: _.label++; y = op[1]; op = [0]; continue;
                        case 7: op = _.ops.pop(); _.trys.pop(); continue;
                        default:
                            if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                            if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                            if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                            if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                            if (t[2]) _.ops.pop();
                            _.trys.pop(); continue;
                    }
                    op = body.call(thisArg, _);
                } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
                if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
            }
        }

        function __spreadArray(to, from, pack) {
            if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
                if (ar || !(i in from)) {
                    if (!ar) ar = Array.prototype.slice.call(from, 0, i);
                    ar[i] = from[i];
                }
            }
            return to.concat(ar || from);
        }

        var Bounds = /** @class */ (function () {
            function Bounds(x, y, w, h) {
                this.left = x;
                this.top = y;
                this.width = w;
                this.height = h;
            }
            Bounds.prototype.add = function (x, y, w, h) {
                return new Bounds(this.left + x, this.top + y, this.width + w, this.height + h);
            };
            Bounds.fromClientRect = function (clientRect) {
                return new Bounds(clientRect.left, clientRect.top, clientRect.width, clientRect.height);
            };
            return Bounds;
        }());
        var parseBounds = function (node) {
            return Bounds.fromClientRect(node.getBoundingClientRect());
        };
        var parseDocumentSize = function (document) {
            var body = document.body;
            var documentElement = document.documentElement;
            if (!body || !documentElement) {
                throw new Error("Unable to get document size");
            }
            var width = Math.max(Math.max(body.scrollWidth, documentElement.scrollWidth), Math.max(body.offsetWidth, documentElement.offsetWidth), Math.max(body.clientWidth, documentElement.clientWidth));
            var height = Math.max(Math.max(body.scrollHeight, documentElement.scrollHeight), Math.max(body.offsetHeight, documentElement.offsetHeight), Math.max(body.clientHeight, documentElement.clientHeight));
            return new Bounds(0, 0, width, height);
        };

        /*
         * css-line-break 1.1.1 <https://github.com/niklasvh/css-line-break#readme>
         * Copyright (c) 2019 Niklas von Hertzen <https://hertzen.com>
         * Released under MIT License
         */
        var toCodePoints = function (str) {
            var codePoints = [];
            var i = 0;
            var length = str.length;
            while (i < length) {
                var value = str.charCodeAt(i++);
                if (value >= 0xd800 && value <= 0xdbff && i < length) {
                    var extra = str.charCodeAt(i++);
                    if ((extra & 0xfc00) === 0xdc00) {
                        codePoints.push(((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000);
                    }
                    else {
                        codePoints.push(value);
                        i--;
                    }
                }
                else {
                    codePoints.push(value);
                }
            }
            return codePoints;
        };
        var fromCodePoint = function () {
            var codePoints = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                codePoints[_i] = arguments[_i];
            }
            if (String.fromCodePoint) {
                return String.fromCodePoint.apply(String, codePoints);
            }
            var length = codePoints.length;
            if (!length) {
                return '';
            }
            var codeUnits = [];
            var index = -1;
            var result = '';
            while (++index < length) {
                var codePoint = codePoints[index];
                if (codePoint <= 0xffff) {
                    codeUnits.push(codePoint);
                }
                else {
                    codePoint -= 0x10000;
                    codeUnits.push((codePoint >> 10) + 0xd800, codePoint % 0x400 + 0xdc00);
                }
                if (index + 1 === length || codeUnits.length > 0x4000) {
                    result += String.fromCharCode.apply(String, codeUnits);
                    codeUnits.length = 0;
                }
            }
            return result;
        };
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        // Use a lookup table to find the index.
        var lookup = typeof Uint8Array === 'undefined' ? [] : new Uint8Array(256);
        for (var i = 0; i < chars.length; i++) {
            lookup[chars.charCodeAt(i)] = i;
        }
        var decode = function (base64) {
            var bufferLength = base64.length * 0.75, len = base64.length, i, p = 0, encoded1, encoded2, encoded3, encoded4;
            if (base64[base64.length - 1] === '=') {
                bufferLength--;
                if (base64[base64.length - 2] === '=') {
                    bufferLength--;
                }
            }
            var buffer = typeof ArrayBuffer !== 'undefined' &&
                typeof Uint8Array !== 'undefined' &&
                typeof Uint8Array.prototype.slice !== 'undefined'
                ? new ArrayBuffer(bufferLength)
                : new Array(bufferLength);
            var bytes = Array.isArray(buffer) ? buffer : new Uint8Array(buffer);
            for (i = 0; i < len; i += 4) {
                encoded1 = lookup[base64.charCodeAt(i)];
                encoded2 = lookup[base64.charCodeAt(i + 1)];
                encoded3 = lookup[base64.charCodeAt(i + 2)];
                encoded4 = lookup[base64.charCodeAt(i + 3)];
                bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
                bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
                bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
            }
            return buffer;
        };
        var polyUint16Array = function (buffer) {
            var length = buffer.length;
            var bytes = [];
            for (var i = 0; i < length; i += 2) {
                bytes.push((buffer[i + 1] << 8) | buffer[i]);
            }
            return bytes;
        };
        var polyUint32Array = function (buffer) {
            var length = buffer.length;
            var bytes = [];
            for (var i = 0; i < length; i += 4) {
                bytes.push((buffer[i + 3] << 24) | (buffer[i + 2] << 16) | (buffer[i + 1] << 8) | buffer[i]);
            }
            return bytes;
        };

        /** Shift size for getting the index-2 table offset. */
        var UTRIE2_SHIFT_2 = 5;
        /** Shift size for getting the index-1 table offset. */
        var UTRIE2_SHIFT_1 = 6 + 5;
        /**
         * Shift size for shifting left the index array values.
         * Increases possible data size with 16-bit index values at the cost
         * of compactability.
         * This requires data blocks to be aligned by UTRIE2_DATA_GRANULARITY.
         */
        var UTRIE2_INDEX_SHIFT = 2;
        /**
         * Difference between the two shift sizes,
         * for getting an index-1 offset from an index-2 offset. 6=11-5
         */
        var UTRIE2_SHIFT_1_2 = UTRIE2_SHIFT_1 - UTRIE2_SHIFT_2;
        /**
         * The part of the index-2 table for U+D800..U+DBFF stores values for
         * lead surrogate code _units_ not code _points_.
         * Values for lead surrogate code _points_ are indexed with this portion of the table.
         * Length=32=0x20=0x400>>UTRIE2_SHIFT_2. (There are 1024=0x400 lead surrogates.)
         */
        var UTRIE2_LSCP_INDEX_2_OFFSET = 0x10000 >> UTRIE2_SHIFT_2;
        /** Number of entries in a data block. 32=0x20 */
        var UTRIE2_DATA_BLOCK_LENGTH = 1 << UTRIE2_SHIFT_2;
        /** Mask for getting the lower bits for the in-data-block offset. */
        var UTRIE2_DATA_MASK = UTRIE2_DATA_BLOCK_LENGTH - 1;
        var UTRIE2_LSCP_INDEX_2_LENGTH = 0x400 >> UTRIE2_SHIFT_2;
        /** Count the lengths of both BMP pieces. 2080=0x820 */
        var UTRIE2_INDEX_2_BMP_LENGTH = UTRIE2_LSCP_INDEX_2_OFFSET + UTRIE2_LSCP_INDEX_2_LENGTH;
        /**
         * The 2-byte UTF-8 version of the index-2 table follows at offset 2080=0x820.
         * Length 32=0x20 for lead bytes C0..DF, regardless of UTRIE2_SHIFT_2.
         */
        var UTRIE2_UTF8_2B_INDEX_2_OFFSET = UTRIE2_INDEX_2_BMP_LENGTH;
        var UTRIE2_UTF8_2B_INDEX_2_LENGTH = 0x800 >> 6; /* U+0800 is the first code point after 2-byte UTF-8 */
        /**
         * The index-1 table, only used for supplementary code points, at offset 2112=0x840.
         * Variable length, for code points up to highStart, where the last single-value range starts.
         * Maximum length 512=0x200=0x100000>>UTRIE2_SHIFT_1.
         * (For 0x100000 supplementary code points U+10000..U+10ffff.)
         *
         * The part of the index-2 table for supplementary code points starts
         * after this index-1 table.
         *
         * Both the index-1 table and the following part of the index-2 table
         * are omitted completely if there is only BMP data.
         */
        var UTRIE2_INDEX_1_OFFSET = UTRIE2_UTF8_2B_INDEX_2_OFFSET + UTRIE2_UTF8_2B_INDEX_2_LENGTH;
        /**
         * Number of index-1 entries for the BMP. 32=0x20
         * This part of the index-1 table is omitted from the serialized form.
         */
        var UTRIE2_OMITTED_BMP_INDEX_1_LENGTH = 0x10000 >> UTRIE2_SHIFT_1;
        /** Number of entries in an index-2 block. 64=0x40 */
        var UTRIE2_INDEX_2_BLOCK_LENGTH = 1 << UTRIE2_SHIFT_1_2;
        /** Mask for getting the lower bits for the in-index-2-block offset. */
        var UTRIE2_INDEX_2_MASK = UTRIE2_INDEX_2_BLOCK_LENGTH - 1;
        var slice16 = function (view, start, end) {
            if (view.slice) {
                return view.slice(start, end);
            }
            return new Uint16Array(Array.prototype.slice.call(view, start, end));
        };
        var slice32 = function (view, start, end) {
            if (view.slice) {
                return view.slice(start, end);
            }
            return new Uint32Array(Array.prototype.slice.call(view, start, end));
        };
        var createTrieFromBase64 = function (base64) {
            var buffer = decode(base64);
            var view32 = Array.isArray(buffer) ? polyUint32Array(buffer) : new Uint32Array(buffer);
            var view16 = Array.isArray(buffer) ? polyUint16Array(buffer) : new Uint16Array(buffer);
            var headerLength = 24;
            var index = slice16(view16, headerLength / 2, view32[4] / 2);
            var data = view32[5] === 2
                ? slice16(view16, (headerLength + view32[4]) / 2)
                : slice32(view32, Math.ceil((headerLength + view32[4]) / 4));
            return new Trie(view32[0], view32[1], view32[2], view32[3], index, data);
        };
        var Trie = /** @class */ (function () {
            function Trie(initialValue, errorValue, highStart, highValueIndex, index, data) {
                this.initialValue = initialValue;
                this.errorValue = errorValue;
                this.highStart = highStart;
                this.highValueIndex = highValueIndex;
                this.index = index;
                this.data = data;
            }
            /**
             * Get the value for a code point as stored in the Trie.
             *
             * @param codePoint the code point
             * @return the value
             */
            Trie.prototype.get = function (codePoint) {
                var ix;
                if (codePoint >= 0) {
                    if (codePoint < 0x0d800 || (codePoint > 0x0dbff && codePoint <= 0x0ffff)) {
                        // Ordinary BMP code point, excluding leading surrogates.
                        // BMP uses a single level lookup.  BMP index starts at offset 0 in the Trie2 index.
                        // 16 bit data is stored in the index array itself.
                        ix = this.index[codePoint >> UTRIE2_SHIFT_2];
                        ix = (ix << UTRIE2_INDEX_SHIFT) + (codePoint & UTRIE2_DATA_MASK);
                        return this.data[ix];
                    }
                    if (codePoint <= 0xffff) {
                        // Lead Surrogate Code Point.  A Separate index section is stored for
                        // lead surrogate code units and code points.
                        //   The main index has the code unit data.
                        //   For this function, we need the code point data.
                        // Note: this expression could be refactored for slightly improved efficiency, but
                        //       surrogate code points will be so rare in practice that it's not worth it.
                        ix = this.index[UTRIE2_LSCP_INDEX_2_OFFSET + ((codePoint - 0xd800) >> UTRIE2_SHIFT_2)];
                        ix = (ix << UTRIE2_INDEX_SHIFT) + (codePoint & UTRIE2_DATA_MASK);
                        return this.data[ix];
                    }
                    if (codePoint < this.highStart) {
                        // Supplemental code point, use two-level lookup.
                        ix = UTRIE2_INDEX_1_OFFSET - UTRIE2_OMITTED_BMP_INDEX_1_LENGTH + (codePoint >> UTRIE2_SHIFT_1);
                        ix = this.index[ix];
                        ix += (codePoint >> UTRIE2_SHIFT_2) & UTRIE2_INDEX_2_MASK;
                        ix = this.index[ix];
                        ix = (ix << UTRIE2_INDEX_SHIFT) + (codePoint & UTRIE2_DATA_MASK);
                        return this.data[ix];
                    }
                    if (codePoint <= 0x10ffff) {
                        return this.data[this.highValueIndex];
                    }
                }
                // Fall through.  The code point is outside of the legal range of 0..0x10ffff.
                return this.errorValue;
            };
            return Trie;
        }());

        var base64 = 'KwAAAAAAAAAACA4AIDoAAPAfAAACAAAAAAAIABAAGABAAEgAUABYAF4AZgBeAGYAYABoAHAAeABeAGYAfACEAIAAiACQAJgAoACoAK0AtQC9AMUAXgBmAF4AZgBeAGYAzQDVAF4AZgDRANkA3gDmAOwA9AD8AAQBDAEUARoBIgGAAIgAJwEvATcBPwFFAU0BTAFUAVwBZAFsAXMBewGDATAAiwGTAZsBogGkAawBtAG8AcIBygHSAdoB4AHoAfAB+AH+AQYCDgIWAv4BHgImAi4CNgI+AkUCTQJTAlsCYwJrAnECeQKBAk0CiQKRApkCoQKoArACuALAAsQCzAIwANQC3ALkAjAA7AL0AvwCAQMJAxADGAMwACADJgMuAzYDPgOAAEYDSgNSA1IDUgNaA1oDYANiA2IDgACAAGoDgAByA3YDfgOAAIQDgACKA5IDmgOAAIAAogOqA4AAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAK8DtwOAAIAAvwPHA88D1wPfAyAD5wPsA/QD/AOAAIAABAQMBBIEgAAWBB4EJgQuBDMEIAM7BEEEXgBJBCADUQRZBGEEaQQwADAAcQQ+AXkEgQSJBJEEgACYBIAAoASoBK8EtwQwAL8ExQSAAIAAgACAAIAAgACgAM0EXgBeAF4AXgBeAF4AXgBeANUEXgDZBOEEXgDpBPEE+QQBBQkFEQUZBSEFKQUxBTUFPQVFBUwFVAVcBV4AYwVeAGsFcwV7BYMFiwWSBV4AmgWgBacFXgBeAF4AXgBeAKsFXgCyBbEFugW7BcIFwgXIBcIFwgXQBdQF3AXkBesF8wX7BQMGCwYTBhsGIwYrBjMGOwZeAD8GRwZNBl4AVAZbBl4AXgBeAF4AXgBeAF4AXgBeAF4AXgBeAGMGXgBqBnEGXgBeAF4AXgBeAF4AXgBeAF4AXgB5BoAG4wSGBo4GkwaAAIADHgR5AF4AXgBeAJsGgABGA4AAowarBrMGswagALsGwwbLBjAA0wbaBtoG3QbaBtoG2gbaBtoG2gblBusG8wb7BgMHCwcTBxsHCwcjBysHMAc1BzUHOgdCB9oGSgdSB1oHYAfaBloHaAfaBlIH2gbaBtoG2gbaBtoG2gbaBjUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHbQdeAF4ANQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQd1B30HNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1B4MH2gaKB68EgACAAIAAgACAAIAAgACAAI8HlwdeAJ8HpweAAIAArwe3B14AXgC/B8UHygcwANAH2AfgB4AA6AfwBz4B+AcACFwBCAgPCBcIogEYAR8IJwiAAC8INwg/CCADRwhPCFcIXwhnCEoDGgSAAIAAgABvCHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIfQh3CHgIeQh6CHsIfAh9CHcIeAh5CHoIewh8CH0Idwh4CHkIegh7CHwIhAiLCI4IMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwAJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlggwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAANQc1BzUHNQc1BzUHNQc1BzUHNQc1B54INQc1B6II2gaqCLIIugiAAIAAvgjGCIAAgACAAIAAgACAAIAAgACAAIAAywiHAYAA0wiAANkI3QjlCO0I9Aj8CIAAgACAAAIJCgkSCRoJIgknCTYHLwk3CZYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiWCJYIlgiAAIAAAAFAAXgBeAGAAcABeAHwAQACQAKAArQC9AJ4AXgBeAE0A3gBRAN4A7AD8AMwBGgEAAKcBNwEFAUwBXAF4QkhCmEKnArcCgAHHAsABz4LAAcABwAHAAd+C6ABoAG+C/4LAAcABwAHAAc+DF4MAAcAB54M3gweDV4Nng3eDaABoAGgAaABoAGgAaABoAGgAaABoAGgAaABoAGgAaABoAGgAaABoAEeDqABVg6WDqABoQ6gAaABoAHXDvcONw/3DvcO9w73DvcO9w73DvcO9w73DvcO9w73DvcO9w73DvcO9w73DvcO9w73DvcO9w73DvcO9w73DvcO9w73DncPAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcAB7cPPwlGCU4JMACAAIAAgABWCV4JYQmAAGkJcAl4CXwJgAkwADAAMAAwAIgJgACLCZMJgACZCZ8JowmrCYAAswkwAF4AXgB8AIAAuwkABMMJyQmAAM4JgADVCTAAMAAwADAAgACAAIAAgACAAIAAgACAAIAAqwYWBNkIMAAwADAAMADdCeAJ6AnuCR4E9gkwAP4JBQoNCjAAMACAABUK0wiAAB0KJAosCjQKgAAwADwKQwqAAEsKvQmdCVMKWwowADAAgACAALcEMACAAGMKgABrCjAAMAAwADAAMAAwADAAMAAwADAAMAAeBDAAMAAwADAAMAAwADAAMAAwADAAMAAwAIkEPQFzCnoKiQSCCooKkAqJBJgKoAqkCokEGAGsCrQKvArBCjAAMADJCtEKFQHZCuEK/gHpCvEKMAAwADAAMACAAIwE+QowAIAAPwEBCzAAMAAwADAAMACAAAkLEQswAIAAPwEZCyELgAAOCCkLMAAxCzkLMAAwADAAMAAwADAAXgBeAEELMAAwADAAMAAwADAAMAAwAEkLTQtVC4AAXAtkC4AAiQkwADAAMAAwADAAMAAwADAAbAtxC3kLgAuFC4sLMAAwAJMLlwufCzAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAApwswADAAMACAAIAAgACvC4AAgACAAIAAgACAALcLMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAvwuAAMcLgACAAIAAgACAAIAAyguAAIAAgACAAIAA0QswADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAANkLgACAAIAA4AswADAAMAAwADAAMAAwADAAMAAwADAAMAAwAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACJCR4E6AswADAAhwHwC4AA+AsADAgMEAwwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMACAAIAAGAwdDCUMMAAwAC0MNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQw1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHPQwwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADUHNQc1BzUHNQc1BzUHNQc2BzAAMAA5DDUHNQc1BzUHNQc1BzUHNQc1BzUHNQdFDDAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAgACAAIAATQxSDFoMMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwAF4AXgBeAF4AXgBeAF4AYgxeAGoMXgBxDHkMfwxeAIUMXgBeAI0MMAAwADAAMAAwAF4AXgCVDJ0MMAAwADAAMABeAF4ApQxeAKsMswy7DF4Awgy9DMoMXgBeAF4AXgBeAF4AXgBeAF4AXgDRDNkMeQBqCeAM3Ax8AOYM7Az0DPgMXgBeAF4AXgBeAF4AXgBeAF4AXgBeAF4AXgBeAF4AXgCgAAANoAAHDQ4NFg0wADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAeDSYNMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwAIAAgACAAIAAgACAAC4NMABeAF4ANg0wADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwAD4NRg1ODVYNXg1mDTAAbQ0wADAAMAAwADAAMAAwADAA2gbaBtoG2gbaBtoG2gbaBnUNeg3CBYANwgWFDdoGjA3aBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gaUDZwNpA2oDdoG2gawDbcNvw3HDdoG2gbPDdYN3A3fDeYN2gbsDfMN2gbaBvoN/g3aBgYODg7aBl4AXgBeABYOXgBeACUG2gYeDl4AJA5eACwO2w3aBtoGMQ45DtoG2gbaBtoGQQ7aBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gZJDjUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1B1EO2gY1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQdZDjUHNQc1BzUHNQc1B2EONQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHaA41BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1B3AO2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gY1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1BzUHNQc1B2EO2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gZJDtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBtoG2gbaBkkOeA6gAKAAoAAwADAAMAAwAKAAoACgAKAAoACgAKAAgA4wADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAD//wQABAAEAAQABAAEAAQABAAEAA0AAwABAAEAAgAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAKABMAFwAeABsAGgAeABcAFgASAB4AGwAYAA8AGAAcAEsASwBLAEsASwBLAEsASwBLAEsAGAAYAB4AHgAeABMAHgBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAFgAbABIAHgAeAB4AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQABYADQARAB4ABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsABAAEAAQABAAEAAUABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAkAFgAaABsAGwAbAB4AHQAdAB4ATwAXAB4ADQAeAB4AGgAbAE8ATwAOAFAAHQAdAB0ATwBPABcATwBPAE8AFgBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB0AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgBQAB4AHgAeAB4AUABQAFAAUAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAB4AHgAeAFAATwBAAE8ATwBPAEAATwBQAFAATwBQAB4AHgAeAB4AHgAeAB0AHQAdAB0AHgAdAB4ADgBQAFAAUABQAFAAHgAeAB4AHgAeAB4AHgBQAB4AUAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4ABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAJAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAkACQAJAAkACQAJAAkABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAeAB4AHgAeAFAAHgAeAB4AKwArAFAAUABQAFAAGABQACsAKwArACsAHgAeAFAAHgBQAFAAUAArAFAAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4ABAAEAAQABAAEAAQABAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAUAAeAB4AHgAeAB4AHgArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwAYAA0AKwArAB4AHgAbACsABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQADQAEAB4ABAAEAB4ABAAEABMABAArACsAKwArACsAKwArACsAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAKwArACsAKwArAFYAVgBWAB4AHgArACsAKwArACsAKwArACsAKwArACsAHgAeAB4AHgAeAB4AHgAeAB4AGgAaABoAGAAYAB4AHgAEAAQABAAEAAQABAAEAAQABAAEAAQAEwAEACsAEwATAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABABLAEsASwBLAEsASwBLAEsASwBLABoAGQAZAB4AUABQAAQAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQABMAUAAEAAQABAAEAAQABAAEAB4AHgAEAAQABAAEAAQABABQAFAABAAEAB4ABAAEAAQABABQAFAASwBLAEsASwBLAEsASwBLAEsASwBQAFAAUAAeAB4AUAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwAeAFAABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQABAAEAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQAUABQAB4AHgAYABMAUAArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAFAABAAEAAQABAAEAFAABAAEAAQAUAAEAAQABAAEAAQAKwArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAArACsAHgArAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAeAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABABQAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAFAABAAEAAQABAAEAAQABABQAFAAUABQAFAAUABQAFAAUABQAAQABAANAA0ASwBLAEsASwBLAEsASwBLAEsASwAeAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQAKwBQAFAAUABQAFAAUABQAFAAKwArAFAAUAArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUAArAFAAKwArACsAUABQAFAAUAArACsABABQAAQABAAEAAQABAAEAAQAKwArAAQABAArACsABAAEAAQAUAArACsAKwArACsAKwArACsABAArACsAKwArAFAAUAArAFAAUABQAAQABAArACsASwBLAEsASwBLAEsASwBLAEsASwBQAFAAGgAaAFAAUABQAFAAUABMAB4AGwBQAB4AKwArACsABAAEAAQAKwBQAFAAUABQAFAAUAArACsAKwArAFAAUAArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUAArAFAAUAArAFAAUAArAFAAUAArACsABAArAAQABAAEAAQABAArACsAKwArAAQABAArACsABAAEAAQAKwArACsABAArACsAKwArACsAKwArAFAAUABQAFAAKwBQACsAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwAEAAQAUABQAFAABAArACsAKwArACsAKwArACsAKwArACsABAAEAAQAKwBQAFAAUABQAFAAUABQAFAAUAArAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUAArAFAAUAArAFAAUABQAFAAUAArACsABABQAAQABAAEAAQABAAEAAQABAArAAQABAAEACsABAAEAAQAKwArAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAAQABAArACsASwBLAEsASwBLAEsASwBLAEsASwAeABsAKwArACsAKwArACsAKwBQAAQABAAEAAQABAAEACsABAAEAAQAKwBQAFAAUABQAFAAUABQAFAAKwArAFAAUAArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQAKwArAAQABAArACsABAAEAAQAKwArACsAKwArACsAKwArAAQABAArACsAKwArAFAAUAArAFAAUABQAAQABAArACsASwBLAEsASwBLAEsASwBLAEsASwAeAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwAEAFAAKwBQAFAAUABQAFAAUAArACsAKwBQAFAAUAArAFAAUABQAFAAKwArACsAUABQACsAUAArAFAAUAArACsAKwBQAFAAKwArACsAUABQAFAAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwAEAAQABAAEAAQAKwArACsABAAEAAQAKwAEAAQABAAEACsAKwBQACsAKwArACsAKwArAAQAKwArACsAKwArACsAKwArACsAKwBLAEsASwBLAEsASwBLAEsASwBLAFAAUABQAB4AHgAeAB4AHgAeABsAHgArACsAKwArACsABAAEAAQABAArAFAAUABQAFAAUABQAFAAUAArAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArAFAABAAEAAQABAAEAAQABAArAAQABAAEACsABAAEAAQABAArACsAKwArACsAKwArAAQABAArAFAAUABQACsAKwArACsAKwBQAFAABAAEACsAKwBLAEsASwBLAEsASwBLAEsASwBLACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAB4AUAAEAAQABAArAFAAUABQAFAAUABQAFAAUAArAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQACsAKwAEAFAABAAEAAQABAAEAAQABAArAAQABAAEACsABAAEAAQABAArACsAKwArACsAKwArAAQABAArACsAKwArACsAKwArAFAAKwBQAFAABAAEACsAKwBLAEsASwBLAEsASwBLAEsASwBLACsAUABQACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAFAABAAEAAQABAAEAAQABAArAAQABAAEACsABAAEAAQABABQAB4AKwArACsAKwBQAFAAUAAEAFAAUABQAFAAUABQAFAAUABQAFAABAAEACsAKwBLAEsASwBLAEsASwBLAEsASwBLAFAAUABQAFAAUABQAFAAUABQABoAUABQAFAAUABQAFAAKwArAAQABAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQACsAUAArACsAUABQAFAAUABQAFAAUAArACsAKwAEACsAKwArACsABAAEAAQABAAEAAQAKwAEACsABAAEAAQABAAEAAQABAAEACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArAAQABAAeACsAKwArACsAKwArACsAKwArACsAKwArAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXAAqAFwAXAAqACoAKgAqACoAKgAqACsAKwArACsAGwBcAFwAXABcAFwAXABcACoAKgAqACoAKgAqACoAKgAeAEsASwBLAEsASwBLAEsASwBLAEsADQANACsAKwArACsAKwBcAFwAKwBcACsAKwBcAFwAKwBcACsAKwBcACsAKwArACsAKwArAFwAXABcAFwAKwBcAFwAXABcAFwAXABcACsAXABcAFwAKwBcACsAXAArACsAXABcACsAXABcAFwAXAAqAFwAXAAqACoAKgAqACoAKgArACoAKgBcACsAKwBcAFwAXABcAFwAKwBcACsAKgAqACoAKgAqACoAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArAFwAXABcAFwAUAAOAA4ADgAOAB4ADgAOAAkADgAOAA0ACQATABMAEwATABMACQAeABMAHgAeAB4ABAAEAB4AHgAeAB4AHgAeAEsASwBLAEsASwBLAEsASwBLAEsAUABQAFAAUABQAFAAUABQAFAAUAANAAQAHgAEAB4ABAAWABEAFgARAAQABABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAANAAQABAAEAAQABAANAAQABABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQABAAEACsABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsADQANAB4AHgAeAB4AHgAeAAQAHgAeAB4AHgAeAB4AKwAeAB4ADgAOAA0ADgAeAB4AHgAeAB4ACQAJACsAKwArACsAKwBcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqAFwASwBLAEsASwBLAEsASwBLAEsASwANAA0AHgAeAB4AHgBcAFwAXABcAFwAXAAqACoAKgAqAFwAXABcAFwAKgAqACoAXAAqACoAKgBcAFwAKgAqACoAKgAqACoAKgBcAFwAXAAqACoAKgAqAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAKgAqACoAKgAqACoAKgAqACoAKgAqACoAXAAqAEsASwBLAEsASwBLAEsASwBLAEsAKgAqACoAKgAqACoAUABQAFAAUABQAFAAKwBQACsAKwArACsAKwBQACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAFAAUABQAFAAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQACsAKwBQAFAAUABQAFAAUABQACsAUAArAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUAArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUAArACsAUABQAFAAUABQAFAAUAArAFAAKwBQAFAAUABQACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwAEAAQABAAeAA0AHgAeAB4AHgAeAB4AHgBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAB4AHgAeAB4AHgAeAB4AHgAeACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAFAAUABQAFAAUABQACsAKwANAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAB4AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAA0AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQABYAEQArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAADQANAA0AUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAABAAEAAQAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAA0ADQArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQACsABAAEACsAKwArACsAKwArACsAKwArACsAKwArAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXAAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoADQANABUAXAANAB4ADQAbAFwAKgArACsASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArAB4AHgATABMADQANAA4AHgATABMAHgAEAAQABAAJACsASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAUABQAFAAUABQAAQABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABABQACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwArACsABAAEAAQABAAEAAQABAAEAAQABAAEAAQAKwArACsAKwAeACsAKwArABMAEwBLAEsASwBLAEsASwBLAEsASwBLAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcACsAKwBcAFwAXABcAFwAKwArACsAKwArACsAKwArACsAKwArAFwAXABcAFwAXABcAFwAXABcAFwAXABcACsAKwArACsAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwBcACsAKwArACoAKgBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEACsAKwAeAB4AXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAKgAqACoAKgAqACoAKgAqACoAKgArACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgArACsABABLAEsASwBLAEsASwBLAEsASwBLACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAKgAqACoAKgAqACoAKgBcACoAKgAqACoAKgAqACsAKwAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArAAQABAAEAAQABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQAUABQAFAAUABQAFAAUAArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsADQANAB4ADQANAA0ADQAeAB4AHgAeAB4AHgAeAB4AHgAeAAQABAAEAAQABAAEAAQABAAEAB4AHgAeAB4AHgAeAB4AHgAeACsAKwArAAQABAAEAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAUABQAEsASwBLAEsASwBLAEsASwBLAEsAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArACsAKwArACsAKwArACsAHgAeAB4AHgBQAFAAUABQAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArACsAKwANAA0ADQANAA0ASwBLAEsASwBLAEsASwBLAEsASwArACsAKwBQAFAAUABLAEsASwBLAEsASwBLAEsASwBLAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAANAA0AUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAB4AHgAeAB4AHgAeAB4AHgArACsAKwArACsAKwArACsABAAEAAQAHgAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAFAAUABQAFAABABQAFAAUABQAAQABAAEAFAAUAAEAAQABAArACsAKwArACsAKwAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAKwAEAAQABAAEAAQAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArACsAUABQAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUAArAFAAKwBQACsAUAArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACsAHgAeAB4AHgAeAB4AHgAeAFAAHgAeAB4AUABQAFAAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAFAAUABQAFAAKwArAB4AHgAeAB4AHgAeACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArACsAUABQAFAAKwAeAB4AHgAeAB4AHgAeAA4AHgArAA0ADQANAA0ADQANAA0ACQANAA0ADQAIAAQACwAEAAQADQAJAA0ADQAMAB0AHQAeABcAFwAWABcAFwAXABYAFwAdAB0AHgAeABQAFAAUAA0AAQABAAQABAAEAAQABAAJABoAGgAaABoAGgAaABoAGgAeABcAFwAdABUAFQAeAB4AHgAeAB4AHgAYABYAEQAVABUAFQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgANAB4ADQANAA0ADQAeAA0ADQANAAcAHgAeAB4AHgArAAQABAAEAAQABAAEAAQABAAEAAQAUABQACsAKwBPAFAAUABQAFAAUAAeAB4AHgAWABEATwBQAE8ATwBPAE8AUABQAFAAUABQAB4AHgAeABYAEQArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAGwAbABsAGwAbABsAGwAaABsAGwAbABsAGwAbABsAGwAbABsAGwAbABsAGwAaABsAGwAbABsAGgAbABsAGgAbABsAGwAbABsAGwAbABsAGwAbABsAGwAbABsAGwAbABsABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAB4AHgBQABoAHgAdAB4AUAAeABoAHgAeAB4AHgAeAB4AHgAeAB4ATwAeAFAAGwAeAB4AUABQAFAAUABQAB4AHgAeAB0AHQAeAFAAHgBQAB4AUAAeAFAATwBQAFAAHgAeAB4AHgAeAB4AHgBQAFAAUABQAFAAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgBQAB4AUABQAFAAUABPAE8AUABQAFAAUABQAE8AUABQAE8AUABPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBQAFAAUABQAE8ATwBPAE8ATwBPAE8ATwBPAE8AUABQAFAAUABQAFAAUABQAFAAHgAeAFAAUABQAFAATwAeAB4AKwArACsAKwAdAB0AHQAdAB0AHQAdAB0AHQAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAB4AHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHQAeAB0AHQAeAB4AHgAdAB0AHgAeAB0AHgAeAB4AHQAeAB0AGwAbAB4AHQAeAB4AHgAeAB0AHgAeAB0AHQAdAB0AHgAeAB0AHgAdAB4AHQAdAB0AHQAdAB0AHgAdAB4AHgAeAB4AHgAdAB0AHQAdAB4AHgAeAB4AHQAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHQAeAB4AHgAdAB4AHgAeAB4AHgAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHQAdAB4AHgAdAB0AHQAdAB4AHgAdAB0AHgAeAB0AHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAB0AHgAeAB0AHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB0AHgAeAB4AHQAeAB4AHgAeAB4AHgAeAB0AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeABQAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAWABEAFgARAB4AHgAeAB4AHgAeAB0AHgAeAB4AHgAeAB4AHgAlACUAHgAeAB4AHgAeAB4AHgAeAB4AFgARAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACUAJQAlACUAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBQAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB4AHgAeAB4AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHgAeAB0AHQAdAB0AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAB0AHgAdAB0AHQAdAB0AHQAdAB4AHgAeAB4AHgAeAB4AHgAdAB0AHgAeAB0AHQAeAB4AHgAeAB0AHQAeAB4AHgAeAB0AHQAdAB4AHgAdAB4AHgAdAB0AHQAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHQAdAB0AHQAeAB4AHgAeAB4AHgAeAB4AHgAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAeAB0AHQAeAB4AHQAeAB4AHgAeAB0AHQAeAB4AHgAeACUAJQAdAB0AJQAeACUAJQAlACAAJQAlAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AJQAlACUAHgAeAB4AHgAdAB4AHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHQAdAB4AHQAdAB0AHgAdACUAHQAdAB4AHQAdAB4AHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAlAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB0AHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAlACUAJQAlACUAJQAlACUAHQAdAB0AHQAlAB4AJQAlACUAHQAlACUAHQAdAB0AJQAlAB0AHQAlAB0AHQAlACUAJQAeAB0AHgAeAB4AHgAdAB0AJQAdAB0AHQAdAB0AHQAlACUAJQAlACUAHQAlACUAIAAlAB0AHQAlACUAJQAlACUAJQAlACUAHgAeAB4AJQAlACAAIAAgACAAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAB4AHgAeABcAFwAXABcAFwAXAB4AEwATACUAHgAeAB4AFgARABYAEQAWABEAFgARABYAEQAWABEAFgARAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAWABEAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AFgARABYAEQAWABEAFgARABYAEQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeABYAEQAWABEAFgARABYAEQAWABEAFgARABYAEQAWABEAFgARABYAEQAWABEAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AFgARABYAEQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeABYAEQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHQAdAB0AHQAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwAeAB4AHgAeAB4AHgAeAB4AHgArACsAKwArACsAKwArACsAKwArACsAKwArAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAEAAQABAAeAB4AKwArACsAKwArABMADQANAA0AUAATAA0AUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAUAANACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAEAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQACsAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXAA0ADQANAA0ADQANAA0ADQAeAA0AFgANAB4AHgAXABcAHgAeABcAFwAWABEAFgARABYAEQAWABEADQANAA0ADQATAFAADQANAB4ADQANAB4AHgAeAB4AHgAMAAwADQANAA0AHgANAA0AFgANAA0ADQANAA0ADQANACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACsAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAKwArACsAKwArACsAKwArACsAKwArACsAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAlACUAJQAlACUAJQAlACUAJQAlACUAJQArACsAKwArAA0AEQARACUAJQBHAFcAVwAWABEAFgARABYAEQAWABEAFgARACUAJQAWABEAFgARABYAEQAWABEAFQAWABEAEQAlAFcAVwBXAFcAVwBXAFcAVwBXAAQABAAEAAQABAAEACUAVwBXAFcAVwA2ACUAJQBXAFcAVwBHAEcAJQAlACUAKwBRAFcAUQBXAFEAVwBRAFcAUQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFEAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBRAFcAUQBXAFEAVwBXAFcAVwBXAFcAUQBXAFcAVwBXAFcAVwBRAFEAKwArAAQABAAVABUARwBHAFcAFQBRAFcAUQBXAFEAVwBRAFcAUQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFEAVwBRAFcAUQBXAFcAVwBXAFcAVwBRAFcAVwBXAFcAVwBXAFEAUQBXAFcAVwBXABUAUQBHAEcAVwArACsAKwArACsAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAKwArAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwArACUAJQBXAFcAVwBXACUAJQAlACUAJQAlACUAJQAlACUAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAKwArACsAKwArACUAJQAlACUAKwArACsAKwArACsAKwArACsAKwArACsAUQBRAFEAUQBRAFEAUQBRAFEAUQBRAFEAUQBRAFEAUQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACsAVwBXAFcAVwBXAFcAVwBXAFcAVwAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlAE8ATwBPAE8ATwBPAE8ATwAlAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACUAJQAlACUAJQAlACUAJQAlACUAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAEcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAKwArACsAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAADQATAA0AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABLAEsASwBLAEsASwBLAEsASwBLAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAFAABAAEAAQABAAeAAQABAAEAAQABAAEAAQABAAEAAQAHgBQAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AUABQAAQABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAeAA0ADQANAA0ADQArACsAKwArACsAKwArACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAFAAUABQAFAAUABQAFAAUABQAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AUAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgBQAB4AHgAeAB4AHgAeAFAAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArAB4AHgAeAB4AHgAeAB4AHgArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAAQAUABQAFAABABQAFAAUABQAAQAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAeAB4AHgAeACsAKwArACsAUABQAFAAUABQAFAAHgAeABoAHgArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAADgAOABMAEwArACsAKwArACsAKwArACsABAAEAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAEACsAKwArACsAKwArACsAKwANAA0ASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArACsAKwAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABABQAFAAUABQAFAAUAAeAB4AHgBQAA4AUAArACsAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAA0ADQBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAKwArACsAKwArACsAKwArACsAKwArAB4AWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYACsAKwArAAQAHgAeAB4AHgAeAB4ADQANAA0AHgAeAB4AHgArAFAASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArAB4AHgBcAFwAXABcAFwAKgBcAFwAXABcAFwAXABcAFwAXABcAEsASwBLAEsASwBLAEsASwBLAEsAXABcAFwAXABcACsAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwArACsAKwArACsAKwArAFAAUABQAAQAUABQAFAAUABQAFAAUABQAAQABAArACsASwBLAEsASwBLAEsASwBLAEsASwArACsAHgANAA0ADQBcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAKgAqACoAXAAqACoAKgBcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXAAqAFwAKgAqACoAXABcACoAKgBcAFwAXABcAFwAKgAqAFwAKgBcACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFwAXABcACoAKgBQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAA0ADQBQAFAAUAAEAAQAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUAArACsAUABQAFAAUABQAFAAKwArAFAAUABQAFAAUABQACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQADQAEAAQAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAVABVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBUAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVACsAKwArACsAKwArACsAKwArACsAKwArAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAKwArACsAKwBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAKwArACsAKwAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACUAJQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAJQAlACUAJQAlACUAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAKwArACsAKwArAFYABABWAFYAVgBWAFYAVgBWAFYAVgBWAB4AVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgArAFYAVgBWAFYAVgArAFYAKwBWAFYAKwBWAFYAKwBWAFYAVgBWAFYAVgBWAFYAVgBWAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAEQAWAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUAAaAB4AKwArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAGAARABEAGAAYABMAEwAWABEAFAArACsAKwArACsAKwAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACUAJQAlACUAJQAWABEAFgARABYAEQAWABEAFgARABYAEQAlACUAFgARACUAJQAlACUAJQAlACUAEQAlABEAKwAVABUAEwATACUAFgARABYAEQAWABEAJQAlACUAJQAlACUAJQAlACsAJQAbABoAJQArACsAKwArAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAAcAKwATACUAJQAbABoAJQAlABYAEQAlACUAEQAlABEAJQBXAFcAVwBXAFcAVwBXAFcAVwBXABUAFQAlACUAJQATACUAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXABYAJQARACUAJQAlAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwAWACUAEQAlABYAEQARABYAEQARABUAVwBRAFEAUQBRAFEAUQBRAFEAUQBRAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAEcARwArACsAVwBXAFcAVwBXAFcAKwArAFcAVwBXAFcAVwBXACsAKwBXAFcAVwBXAFcAVwArACsAVwBXAFcAKwArACsAGgAbACUAJQAlABsAGwArAB4AHgAeAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAKwAEAAQABAAQAB0AKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsADQANAA0AKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArAB4AHgAeAB4AHgAeAB4AHgAeAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgBQAFAAHgAeAB4AKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArACsAKwArAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4ABAArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAAQAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsADQBQAFAAUABQACsAKwArACsAUABQAFAAUABQAFAAUABQAA0AUABQAFAAUABQACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUAArACsAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQACsAKwArAFAAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAA0AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAB4AHgBQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsADQBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArAB4AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwBQAFAAUABQAFAABAAEAAQAKwAEAAQAKwArACsAKwArAAQABAAEAAQAUABQAFAAUAArAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsABAAEAAQAKwArACsAKwAEAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsADQANAA0ADQANAA0ADQANAB4AKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAB4AUABQAFAAUABQAFAAUABQAB4AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEACsAKwArACsAUABQAFAAUABQAA0ADQANAA0ADQANABQAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwANAA0ADQANAA0ADQANAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAHgAeAB4AHgArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwBQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAA0ADQAeAB4AHgAeAB4AKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAEAAQABAAEAAQABAAeAB4AHgANAA0ADQANACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwBLAEsASwBLAEsASwBLAEsASwBLACsAKwArACsAKwArAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsASwBLAEsASwBLAEsASwBLAEsASwANAA0ADQANACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAeAA4AUAArACsAKwArACsAKwArACsAKwAEAFAAUABQAFAADQANAB4ADQAeAAQABAAEAB4AKwArAEsASwBLAEsASwBLAEsASwBLAEsAUAAOAFAADQANAA0AKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQABAANAA0AHgANAA0AHgAEACsAUABQAFAAUABQAFAAUAArAFAAKwBQAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAA0AKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsABAAEAAQABAArAFAAUABQAFAAUABQAFAAUAArACsAUABQACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAArACsABAAEACsAKwAEAAQABAArACsAUAArACsAKwArACsAKwAEACsAKwArACsAKwBQAFAAUABQAFAABAAEACsAKwAEAAQABAAEAAQABAAEACsAKwArAAQABAAEAAQABAArACsAKwArACsAKwArACsAKwArACsABAAEAAQABAAEAAQABABQAFAAUABQAA0ADQANAA0AHgBLAEsASwBLAEsASwBLAEsASwBLACsADQArAB4AKwArAAQABAAEAAQAUABQAB4AUAArACsAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEACsAKwAEAAQABAAEAAQABAAEAAQABAAOAA0ADQATABMAHgAeAB4ADQANAA0ADQANAA0ADQANAA0ADQANAA0ADQANAA0AUABQAFAAUAAEAAQAKwArAAQADQANAB4AUAArACsAKwArACsAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArACsAKwAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXAArACsAKwAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAXABcAA0ADQANACoASwBLAEsASwBLAEsASwBLAEsASwBQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwBQAFAABAAEAAQABAAEAAQABAAEAAQABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAFAABAAEAAQABAAOAB4ADQANAA0ADQAOAB4ABAArACsAKwArACsAKwArACsAUAAEAAQABAAEAAQABAAEAAQABAAEAAQAUABQAFAAUAArACsAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAA0ADQANACsADgAOAA4ADQANACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEACsABAAEAAQABAAEAAQABAAEAFAADQANAA0ADQANACsAKwArACsAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwAOABMAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQACsAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAArACsAKwAEACsABAAEACsABAAEAAQABAAEAAQABABQAAQAKwArACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsADQANAA0ADQANACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAASABIAEgAQwBDAEMAUABQAFAAUABDAFAAUABQAEgAQwBIAEMAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAASABDAEMAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABIAEMAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwANAA0AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAAQABAAEAAQABAANACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAA0ADQANAB4AHgAeAB4AHgAeAFAAUABQAFAADQAeACsAKwArACsAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwArAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAUAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsABAAEAAQABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAEcARwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwArACsAKwArACsAKwArACsAKwArACsAKwArAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQACsAKwAeAAQABAANAAQABAAEAAQAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACsAKwArACsAKwArACsAKwArACsAHgAeAB4AHgAeAB4AHgArACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4ABAAEAAQABAAEAB4AHgAeAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAHgAeAAQABAAEAAQABAAEAAQAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAEAAQABAAEAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAB4AHgAEAAQABAAeACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArAFAAUAArACsAUAArACsAUABQACsAKwBQAFAAUABQACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwBQACsAUABQAFAAUABQAFAAUAArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAKwAeAB4AUABQAFAAUABQACsAUAArACsAKwBQAFAAUABQAFAAUABQACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAHgAeAB4AHgAeAB4AHgAeAB4AKwArAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAB4AHgAeAB4ABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAB4AHgAeAB4AHgAeAB4AHgAEAB4AHgAeAB4AHgAeAB4AHgAeAB4ABAAeAB4ADQANAA0ADQAeACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAAQABAAEAAQABAArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsABAAEAAQABAAEAAQABAArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArACsABAAEAAQABAAEAAQABAArAAQABAArAAQABAAEAAQABAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAEAAQAKwArACsAKwArACsAKwArACsAHgAeAB4AHgAEAAQABAAEAAQABAAEACsAKwArACsAKwBLAEsASwBLAEsASwBLAEsASwBLACsAKwArACsAFgAWAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUAArAFAAKwArAFAAKwBQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUAArAFAAKwBQACsAKwArACsAKwArAFAAKwArACsAKwBQACsAUAArAFAAKwBQAFAAUAArAFAAUAArAFAAKwArAFAAKwBQACsAUAArAFAAKwBQACsAUABQACsAUAArACsAUABQAFAAUAArAFAAUABQAFAAUABQAFAAKwBQAFAAUABQACsAUABQAFAAUAArAFAAKwBQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwBQAFAAUAArAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAB4AHgArACsAKwArACsAKwArACsAKwArACsAKwArACsATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwAlACUAJQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAeACUAHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHgAeACUAJQAlACUAHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACkAKQApACkAKQApACkAKQApACkAKQApACkAKQApACkAKQApACkAKQApACkAKQApACkAKQAlACUAJQAlACUAIAAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlAB4AHgAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAHgAeACUAJQAlACUAJQAeACUAJQAlACUAJQAgACAAIAAlACUAIAAlACUAIAAgACAAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAIQAhACEAIQAhACUAJQAgACAAJQAlACAAIAAgACAAIAAgACAAIAAgACAAIAAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAIAAgACAAIAAlACUAJQAlACAAJQAgACAAIAAgACAAIAAgACAAIAAlACUAJQAgACUAJQAlACUAIAAgACAAJQAgACAAIAAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAeACUAHgAlAB4AJQAlACUAJQAlACAAJQAlACUAJQAeACUAHgAeACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAHgAeAB4AHgAeAB4AHgAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlAB4AHgAeAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAIAAgACUAJQAlACUAIAAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAIAAlACUAJQAlACAAIAAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAeAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlAB4AHgAeAB4AHgAeACUAJQAlACUAJQAlACUAIAAgACAAJQAlACUAIAAgACAAIAAgAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AFwAXABcAFQAVABUAHgAeAB4AHgAlACUAJQAgACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAIAAgACAAJQAlACUAJQAlACUAJQAlACUAIAAlACUAJQAlACUAJQAlACUAJQAlACUAIAAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAlACUAJQAlACUAJQAlACUAJQAlACUAJQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAlACUAJQAlAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAlACUAJQAlAB4AHgAeAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAlACUAHgAeAB4AHgAeAB4AHgAeACUAJQAlACUAJQAlACUAJQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACUAJQAlACUAJQAlACUAJQAlACUAJQAlACAAIAAgACAAIAAlACAAIAAlACUAJQAlACUAJQAgACUAJQAlACUAJQAlACUAJQAlACAAIAAgACAAIAAgACAAIAAgACAAJQAlACUAIAAgACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACsAKwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAJQAlACUAJQAlACUAJQAlACUAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAJQAlACUAJQAlACUAJQAlACUAJQAlAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQArAAQAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsA';

        /* @flow */
        var LETTER_NUMBER_MODIFIER = 50;
        // Non-tailorable Line Breaking Classes
        var BK = 1; //  Cause a line break (after)
        var CR = 2; //  Cause a line break (after), except between CR and LF
        var LF = 3; //  Cause a line break (after)
        var CM = 4; //  Prohibit a line break between the character and the preceding character
        var NL = 5; //  Cause a line break (after)
        var WJ = 7; //  Prohibit line breaks before and after
        var ZW = 8; //  Provide a break opportunity
        var GL = 9; //  Prohibit line breaks before and after
        var SP = 10; // Enable indirect line breaks
        var ZWJ = 11; // Prohibit line breaks within joiner sequences
        // Break Opportunities
        var B2 = 12; //  Provide a line break opportunity before and after the character
        var BA = 13; //  Generally provide a line break opportunity after the character
        var BB = 14; //  Generally provide a line break opportunity before the character
        var HY = 15; //  Provide a line break opportunity after the character, except in numeric context
        var CB = 16; //   Provide a line break opportunity contingent on additional information
        // Characters Prohibiting Certain Breaks
        var CL = 17; //  Prohibit line breaks before
        var CP = 18; //  Prohibit line breaks before
        var EX = 19; //  Prohibit line breaks before
        var IN = 20; //  Allow only indirect line breaks between pairs
        var NS = 21; //  Allow only indirect line breaks before
        var OP = 22; //  Prohibit line breaks after
        var QU = 23; //  Act like they are both opening and closing
        // Numeric Context
        var IS = 24; //  Prevent breaks after any and before numeric
        var NU = 25; //  Form numeric expressions for line breaking purposes
        var PO = 26; //  Do not break following a numeric expression
        var PR = 27; //  Do not break in front of a numeric expression
        var SY = 28; //  Prevent a break before; and allow a break after
        // Other Characters
        var AI = 29; //  Act like AL when the resolvedEAW is N; otherwise; act as ID
        var AL = 30; //  Are alphabetic characters or symbols that are used with alphabetic characters
        var CJ = 31; //  Treat as NS or ID for strict or normal breaking.
        var EB = 32; //  Do not break from following Emoji Modifier
        var EM = 33; //  Do not break from preceding Emoji Base
        var H2 = 34; //  Form Korean syllable blocks
        var H3 = 35; //  Form Korean syllable blocks
        var HL = 36; //  Do not break around a following hyphen; otherwise act as Alphabetic
        var ID = 37; //  Break before or after; except in some numeric context
        var JL = 38; //  Form Korean syllable blocks
        var JV = 39; //  Form Korean syllable blocks
        var JT = 40; //  Form Korean syllable blocks
        var RI = 41; //  Keep pairs together. For pairs; break before and after other classes
        var SA = 42; //  Provide a line break opportunity contingent on additional, language-specific context analysis
        var XX = 43; //  Have as yet unknown line breaking behavior or unassigned code positions
        var BREAK_MANDATORY = '!';
        var BREAK_NOT_ALLOWED = '×';
        var BREAK_ALLOWED = '÷';
        var UnicodeTrie = createTrieFromBase64(base64);
        var ALPHABETICS = [AL, HL];
        var HARD_LINE_BREAKS = [BK, CR, LF, NL];
        var SPACE$1 = [SP, ZW];
        var PREFIX_POSTFIX = [PR, PO];
        var LINE_BREAKS = HARD_LINE_BREAKS.concat(SPACE$1);
        var KOREAN_SYLLABLE_BLOCK = [JL, JV, JT, H2, H3];
        var HYPHEN = [HY, BA];
        var codePointsToCharacterClasses = function (codePoints, lineBreak) {
            if (lineBreak === void 0) { lineBreak = 'strict'; }
            var types = [];
            var indicies = [];
            var categories = [];
            codePoints.forEach(function (codePoint, index) {
                var classType = UnicodeTrie.get(codePoint);
                if (classType > LETTER_NUMBER_MODIFIER) {
                    categories.push(true);
                    classType -= LETTER_NUMBER_MODIFIER;
                }
                else {
                    categories.push(false);
                }
                if (['normal', 'auto', 'loose'].indexOf(lineBreak) !== -1) {
                    // U+2010, – U+2013, 〜 U+301C, ゠ U+30A0
                    if ([0x2010, 0x2013, 0x301c, 0x30a0].indexOf(codePoint) !== -1) {
                        indicies.push(index);
                        return types.push(CB);
                    }
                }
                if (classType === CM || classType === ZWJ) {
                    // LB10 Treat any remaining combining mark or ZWJ as AL.
                    if (index === 0) {
                        indicies.push(index);
                        return types.push(AL);
                    }
                    // LB9 Do not break a combining character sequence; treat it as if it has the line breaking class of
                    // the base character in all of the following rules. Treat ZWJ as if it were CM.
                    var prev = types[index - 1];
                    if (LINE_BREAKS.indexOf(prev) === -1) {
                        indicies.push(indicies[index - 1]);
                        return types.push(prev);
                    }
                    indicies.push(index);
                    return types.push(AL);
                }
                indicies.push(index);
                if (classType === CJ) {
                    return types.push(lineBreak === 'strict' ? NS : ID);
                }
                if (classType === SA) {
                    return types.push(AL);
                }
                if (classType === AI) {
                    return types.push(AL);
                }
                // For supplementary characters, a useful default is to treat characters in the range 10000..1FFFD as AL
                // and characters in the ranges 20000..2FFFD and 30000..3FFFD as ID, until the implementation can be revised
                // to take into account the actual line breaking properties for these characters.
                if (classType === XX) {
                    if ((codePoint >= 0x20000 && codePoint <= 0x2fffd) || (codePoint >= 0x30000 && codePoint <= 0x3fffd)) {
                        return types.push(ID);
                    }
                    else {
                        return types.push(AL);
                    }
                }
                types.push(classType);
            });
            return [indicies, types, categories];
        };
        var isAdjacentWithSpaceIgnored = function (a, b, currentIndex, classTypes) {
            var current = classTypes[currentIndex];
            if (Array.isArray(a) ? a.indexOf(current) !== -1 : a === current) {
                var i = currentIndex;
                while (i <= classTypes.length) {
                    i++;
                    var next = classTypes[i];
                    if (next === b) {
                        return true;
                    }
                    if (next !== SP) {
                        break;
                    }
                }
            }
            if (current === SP) {
                var i = currentIndex;
                while (i > 0) {
                    i--;
                    var prev = classTypes[i];
                    if (Array.isArray(a) ? a.indexOf(prev) !== -1 : a === prev) {
                        var n = currentIndex;
                        while (n <= classTypes.length) {
                            n++;
                            var next = classTypes[n];
                            if (next === b) {
                                return true;
                            }
                            if (next !== SP) {
                                break;
                            }
                        }
                    }
                    if (prev !== SP) {
                        break;
                    }
                }
            }
            return false;
        };
        var previousNonSpaceClassType = function (currentIndex, classTypes) {
            var i = currentIndex;
            while (i >= 0) {
                var type = classTypes[i];
                if (type === SP) {
                    i--;
                }
                else {
                    return type;
                }
            }
            return 0;
        };
        var _lineBreakAtIndex = function (codePoints, classTypes, indicies, index, forbiddenBreaks) {
            if (indicies[index] === 0) {
                return BREAK_NOT_ALLOWED;
            }
            var currentIndex = index - 1;
            if (Array.isArray(forbiddenBreaks) && forbiddenBreaks[currentIndex] === true) {
                return BREAK_NOT_ALLOWED;
            }
            var beforeIndex = currentIndex - 1;
            var afterIndex = currentIndex + 1;
            var current = classTypes[currentIndex];
            // LB4 Always break after hard line breaks.
            // LB5 Treat CR followed by LF, as well as CR, LF, and NL as hard line breaks.
            var before = beforeIndex >= 0 ? classTypes[beforeIndex] : 0;
            var next = classTypes[afterIndex];
            if (current === CR && next === LF) {
                return BREAK_NOT_ALLOWED;
            }
            if (HARD_LINE_BREAKS.indexOf(current) !== -1) {
                return BREAK_MANDATORY;
            }
            // LB6 Do not break before hard line breaks.
            if (HARD_LINE_BREAKS.indexOf(next) !== -1) {
                return BREAK_NOT_ALLOWED;
            }
            // LB7 Do not break before spaces or zero width space.
            if (SPACE$1.indexOf(next) !== -1) {
                return BREAK_NOT_ALLOWED;
            }
            // LB8 Break before any character following a zero-width space, even if one or more spaces intervene.
            if (previousNonSpaceClassType(currentIndex, classTypes) === ZW) {
                return BREAK_ALLOWED;
            }
            // LB8a Do not break between a zero width joiner and an ideograph, emoji base or emoji modifier.
            if (UnicodeTrie.get(codePoints[currentIndex]) === ZWJ && (next === ID || next === EB || next === EM)) {
                return BREAK_NOT_ALLOWED;
            }
            // LB11 Do not break before or after Word joiner and related characters.
            if (current === WJ || next === WJ) {
                return BREAK_NOT_ALLOWED;
            }
            // LB12 Do not break after NBSP and related characters.
            if (current === GL) {
                return BREAK_NOT_ALLOWED;
            }
            // LB12a Do not break before NBSP and related characters, except after spaces and hyphens.
            if ([SP, BA, HY].indexOf(current) === -1 && next === GL) {
                return BREAK_NOT_ALLOWED;
            }
            // LB13 Do not break before ‘]’ or ‘!’ or ‘;’ or ‘/’, even after spaces.
            if ([CL, CP, EX, IS, SY].indexOf(next) !== -1) {
                return BREAK_NOT_ALLOWED;
            }
            // LB14 Do not break after ‘[’, even after spaces.
            if (previousNonSpaceClassType(currentIndex, classTypes) === OP) {
                return BREAK_NOT_ALLOWED;
            }
            // LB15 Do not break within ‘”[’, even with intervening spaces.
            if (isAdjacentWithSpaceIgnored(QU, OP, currentIndex, classTypes)) {
                return BREAK_NOT_ALLOWED;
            }
            // LB16 Do not break between closing punctuation and a nonstarter (lb=NS), even with intervening spaces.
            if (isAdjacentWithSpaceIgnored([CL, CP], NS, currentIndex, classTypes)) {
                return BREAK_NOT_ALLOWED;
            }
            // LB17 Do not break within ‘——’, even with intervening spaces.
            if (isAdjacentWithSpaceIgnored(B2, B2, currentIndex, classTypes)) {
                return BREAK_NOT_ALLOWED;
            }
            // LB18 Break after spaces.
            if (current === SP) {
                return BREAK_ALLOWED;
            }
            // LB19 Do not break before or after quotation marks, such as ‘ ” ’.
            if (current === QU || next === QU) {
                return BREAK_NOT_ALLOWED;
            }
            // LB20 Break before and after unresolved CB.
            if (next === CB || current === CB) {
                return BREAK_ALLOWED;
            }
            // LB21 Do not break before hyphen-minus, other hyphens, fixed-width spaces, small kana, and other non-starters, or after acute accents.
            if ([BA, HY, NS].indexOf(next) !== -1 || current === BB) {
                return BREAK_NOT_ALLOWED;
            }
            // LB21a Don't break after Hebrew + Hyphen.
            if (before === HL && HYPHEN.indexOf(current) !== -1) {
                return BREAK_NOT_ALLOWED;
            }
            // LB21b Don’t break between Solidus and Hebrew letters.
            if (current === SY && next === HL) {
                return BREAK_NOT_ALLOWED;
            }
            // LB22 Do not break between two ellipses, or between letters, numbers or exclamations and ellipsis.
            if (next === IN && ALPHABETICS.concat(IN, EX, NU, ID, EB, EM).indexOf(current) !== -1) {
                return BREAK_NOT_ALLOWED;
            }
            // LB23 Do not break between digits and letters.
            if ((ALPHABETICS.indexOf(next) !== -1 && current === NU) || (ALPHABETICS.indexOf(current) !== -1 && next === NU)) {
                return BREAK_NOT_ALLOWED;
            }
            // LB23a Do not break between numeric prefixes and ideographs, or between ideographs and numeric postfixes.
            if ((current === PR && [ID, EB, EM].indexOf(next) !== -1) ||
                ([ID, EB, EM].indexOf(current) !== -1 && next === PO)) {
                return BREAK_NOT_ALLOWED;
            }
            // LB24 Do not break between numeric prefix/postfix and letters, or between letters and prefix/postfix.
            if ((ALPHABETICS.indexOf(current) !== -1 && PREFIX_POSTFIX.indexOf(next) !== -1) ||
                (PREFIX_POSTFIX.indexOf(current) !== -1 && ALPHABETICS.indexOf(next) !== -1)) {
                return BREAK_NOT_ALLOWED;
            }
            // LB25 Do not break between the following pairs of classes relevant to numbers:
            if (
            // (PR | PO) × ( OP | HY )? NU
            ([PR, PO].indexOf(current) !== -1 &&
                (next === NU || ([OP, HY].indexOf(next) !== -1 && classTypes[afterIndex + 1] === NU))) ||
                // ( OP | HY ) × NU
                ([OP, HY].indexOf(current) !== -1 && next === NU) ||
                // NU ×	(NU | SY | IS)
                (current === NU && [NU, SY, IS].indexOf(next) !== -1)) {
                return BREAK_NOT_ALLOWED;
            }
            // NU (NU | SY | IS)* × (NU | SY | IS | CL | CP)
            if ([NU, SY, IS, CL, CP].indexOf(next) !== -1) {
                var prevIndex = currentIndex;
                while (prevIndex >= 0) {
                    var type = classTypes[prevIndex];
                    if (type === NU) {
                        return BREAK_NOT_ALLOWED;
                    }
                    else if ([SY, IS].indexOf(type) !== -1) {
                        prevIndex--;
                    }
                    else {
                        break;
                    }
                }
            }
            // NU (NU | SY | IS)* (CL | CP)? × (PO | PR))
            if ([PR, PO].indexOf(next) !== -1) {
                var prevIndex = [CL, CP].indexOf(current) !== -1 ? beforeIndex : currentIndex;
                while (prevIndex >= 0) {
                    var type = classTypes[prevIndex];
                    if (type === NU) {
                        return BREAK_NOT_ALLOWED;
                    }
                    else if ([SY, IS].indexOf(type) !== -1) {
                        prevIndex--;
                    }
                    else {
                        break;
                    }
                }
            }
            // LB26 Do not break a Korean syllable.
            if ((JL === current && [JL, JV, H2, H3].indexOf(next) !== -1) ||
                ([JV, H2].indexOf(current) !== -1 && [JV, JT].indexOf(next) !== -1) ||
                ([JT, H3].indexOf(current) !== -1 && next === JT)) {
                return BREAK_NOT_ALLOWED;
            }
            // LB27 Treat a Korean Syllable Block the same as ID.
            if ((KOREAN_SYLLABLE_BLOCK.indexOf(current) !== -1 && [IN, PO].indexOf(next) !== -1) ||
                (KOREAN_SYLLABLE_BLOCK.indexOf(next) !== -1 && current === PR)) {
                return BREAK_NOT_ALLOWED;
            }
            // LB28 Do not break between alphabetics (“at”).
            if (ALPHABETICS.indexOf(current) !== -1 && ALPHABETICS.indexOf(next) !== -1) {
                return BREAK_NOT_ALLOWED;
            }
            // LB29 Do not break between numeric punctuation and alphabetics (“e.g.”).
            if (current === IS && ALPHABETICS.indexOf(next) !== -1) {
                return BREAK_NOT_ALLOWED;
            }
            // LB30 Do not break between letters, numbers, or ordinary symbols and opening or closing parentheses.
            if ((ALPHABETICS.concat(NU).indexOf(current) !== -1 && next === OP) ||
                (ALPHABETICS.concat(NU).indexOf(next) !== -1 && current === CP)) {
                return BREAK_NOT_ALLOWED;
            }
            // LB30a Break between two regional indicator symbols if and only if there are an even number of regional
            // indicators preceding the position of the break.
            if (current === RI && next === RI) {
                var i = indicies[currentIndex];
                var count = 1;
                while (i > 0) {
                    i--;
                    if (classTypes[i] === RI) {
                        count++;
                    }
                    else {
                        break;
                    }
                }
                if (count % 2 !== 0) {
                    return BREAK_NOT_ALLOWED;
                }
            }
            // LB30b Do not break between an emoji base and an emoji modifier.
            if (current === EB && next === EM) {
                return BREAK_NOT_ALLOWED;
            }
            return BREAK_ALLOWED;
        };
        var cssFormattedClasses = function (codePoints, options) {
            if (!options) {
                options = { lineBreak: 'normal', wordBreak: 'normal' };
            }
            var _a = codePointsToCharacterClasses(codePoints, options.lineBreak), indicies = _a[0], classTypes = _a[1], isLetterNumber = _a[2];
            if (options.wordBreak === 'break-all' || options.wordBreak === 'break-word') {
                classTypes = classTypes.map(function (type) { return ([NU, AL, SA].indexOf(type) !== -1 ? ID : type); });
            }
            var forbiddenBreakpoints = options.wordBreak === 'keep-all'
                ? isLetterNumber.map(function (letterNumber, i) {
                    return letterNumber && codePoints[i] >= 0x4e00 && codePoints[i] <= 0x9fff;
                })
                : undefined;
            return [indicies, classTypes, forbiddenBreakpoints];
        };
        var Break = /** @class */ (function () {
            function Break(codePoints, lineBreak, start, end) {
                this.codePoints = codePoints;
                this.required = lineBreak === BREAK_MANDATORY;
                this.start = start;
                this.end = end;
            }
            Break.prototype.slice = function () {
                return fromCodePoint.apply(void 0, this.codePoints.slice(this.start, this.end));
            };
            return Break;
        }());
        var LineBreaker = function (str, options) {
            var codePoints = toCodePoints(str);
            var _a = cssFormattedClasses(codePoints, options), indicies = _a[0], classTypes = _a[1], forbiddenBreakpoints = _a[2];
            var length = codePoints.length;
            var lastEnd = 0;
            var nextIndex = 0;
            return {
                next: function () {
                    if (nextIndex >= length) {
                        return { done: true, value: null };
                    }
                    var lineBreak = BREAK_NOT_ALLOWED;
                    while (nextIndex < length &&
                        (lineBreak = _lineBreakAtIndex(codePoints, classTypes, indicies, ++nextIndex, forbiddenBreakpoints)) ===
                            BREAK_NOT_ALLOWED) { }
                    if (lineBreak !== BREAK_NOT_ALLOWED || nextIndex === length) {
                        var value = new Break(codePoints, lineBreak, lastEnd, nextIndex);
                        lastEnd = nextIndex;
                        return { value: value, done: false };
                    }
                    return { done: true, value: null };
                },
            };
        };

        // https://www.w3.org/TR/css-syntax-3
        var TokenType;
        (function (TokenType) {
            TokenType[TokenType["STRING_TOKEN"] = 0] = "STRING_TOKEN";
            TokenType[TokenType["BAD_STRING_TOKEN"] = 1] = "BAD_STRING_TOKEN";
            TokenType[TokenType["LEFT_PARENTHESIS_TOKEN"] = 2] = "LEFT_PARENTHESIS_TOKEN";
            TokenType[TokenType["RIGHT_PARENTHESIS_TOKEN"] = 3] = "RIGHT_PARENTHESIS_TOKEN";
            TokenType[TokenType["COMMA_TOKEN"] = 4] = "COMMA_TOKEN";
            TokenType[TokenType["HASH_TOKEN"] = 5] = "HASH_TOKEN";
            TokenType[TokenType["DELIM_TOKEN"] = 6] = "DELIM_TOKEN";
            TokenType[TokenType["AT_KEYWORD_TOKEN"] = 7] = "AT_KEYWORD_TOKEN";
            TokenType[TokenType["PREFIX_MATCH_TOKEN"] = 8] = "PREFIX_MATCH_TOKEN";
            TokenType[TokenType["DASH_MATCH_TOKEN"] = 9] = "DASH_MATCH_TOKEN";
            TokenType[TokenType["INCLUDE_MATCH_TOKEN"] = 10] = "INCLUDE_MATCH_TOKEN";
            TokenType[TokenType["LEFT_CURLY_BRACKET_TOKEN"] = 11] = "LEFT_CURLY_BRACKET_TOKEN";
            TokenType[TokenType["RIGHT_CURLY_BRACKET_TOKEN"] = 12] = "RIGHT_CURLY_BRACKET_TOKEN";
            TokenType[TokenType["SUFFIX_MATCH_TOKEN"] = 13] = "SUFFIX_MATCH_TOKEN";
            TokenType[TokenType["SUBSTRING_MATCH_TOKEN"] = 14] = "SUBSTRING_MATCH_TOKEN";
            TokenType[TokenType["DIMENSION_TOKEN"] = 15] = "DIMENSION_TOKEN";
            TokenType[TokenType["PERCENTAGE_TOKEN"] = 16] = "PERCENTAGE_TOKEN";
            TokenType[TokenType["NUMBER_TOKEN"] = 17] = "NUMBER_TOKEN";
            TokenType[TokenType["FUNCTION"] = 18] = "FUNCTION";
            TokenType[TokenType["FUNCTION_TOKEN"] = 19] = "FUNCTION_TOKEN";
            TokenType[TokenType["IDENT_TOKEN"] = 20] = "IDENT_TOKEN";
            TokenType[TokenType["COLUMN_TOKEN"] = 21] = "COLUMN_TOKEN";
            TokenType[TokenType["URL_TOKEN"] = 22] = "URL_TOKEN";
            TokenType[TokenType["BAD_URL_TOKEN"] = 23] = "BAD_URL_TOKEN";
            TokenType[TokenType["CDC_TOKEN"] = 24] = "CDC_TOKEN";
            TokenType[TokenType["CDO_TOKEN"] = 25] = "CDO_TOKEN";
            TokenType[TokenType["COLON_TOKEN"] = 26] = "COLON_TOKEN";
            TokenType[TokenType["SEMICOLON_TOKEN"] = 27] = "SEMICOLON_TOKEN";
            TokenType[TokenType["LEFT_SQUARE_BRACKET_TOKEN"] = 28] = "LEFT_SQUARE_BRACKET_TOKEN";
            TokenType[TokenType["RIGHT_SQUARE_BRACKET_TOKEN"] = 29] = "RIGHT_SQUARE_BRACKET_TOKEN";
            TokenType[TokenType["UNICODE_RANGE_TOKEN"] = 30] = "UNICODE_RANGE_TOKEN";
            TokenType[TokenType["WHITESPACE_TOKEN"] = 31] = "WHITESPACE_TOKEN";
            TokenType[TokenType["EOF_TOKEN"] = 32] = "EOF_TOKEN";
        })(TokenType || (TokenType = {}));
        var FLAG_UNRESTRICTED = 1 << 0;
        var FLAG_ID = 1 << 1;
        var FLAG_INTEGER = 1 << 2;
        var FLAG_NUMBER = 1 << 3;
        var LINE_FEED = 0x000a;
        var SOLIDUS = 0x002f;
        var REVERSE_SOLIDUS = 0x005c;
        var CHARACTER_TABULATION = 0x0009;
        var SPACE = 0x0020;
        var QUOTATION_MARK = 0x0022;
        var EQUALS_SIGN = 0x003d;
        var NUMBER_SIGN = 0x0023;
        var DOLLAR_SIGN = 0x0024;
        var PERCENTAGE_SIGN = 0x0025;
        var APOSTROPHE = 0x0027;
        var LEFT_PARENTHESIS = 0x0028;
        var RIGHT_PARENTHESIS = 0x0029;
        var LOW_LINE = 0x005f;
        var HYPHEN_MINUS = 0x002d;
        var EXCLAMATION_MARK = 0x0021;
        var LESS_THAN_SIGN = 0x003c;
        var GREATER_THAN_SIGN = 0x003e;
        var COMMERCIAL_AT = 0x0040;
        var LEFT_SQUARE_BRACKET = 0x005b;
        var RIGHT_SQUARE_BRACKET = 0x005d;
        var CIRCUMFLEX_ACCENT = 0x003d;
        var LEFT_CURLY_BRACKET = 0x007b;
        var QUESTION_MARK = 0x003f;
        var RIGHT_CURLY_BRACKET = 0x007d;
        var VERTICAL_LINE = 0x007c;
        var TILDE = 0x007e;
        var CONTROL = 0x0080;
        var REPLACEMENT_CHARACTER = 0xfffd;
        var ASTERISK = 0x002a;
        var PLUS_SIGN = 0x002b;
        var COMMA = 0x002c;
        var COLON = 0x003a;
        var SEMICOLON = 0x003b;
        var FULL_STOP = 0x002e;
        var NULL = 0x0000;
        var BACKSPACE = 0x0008;
        var LINE_TABULATION = 0x000b;
        var SHIFT_OUT = 0x000e;
        var INFORMATION_SEPARATOR_ONE = 0x001f;
        var DELETE = 0x007f;
        var EOF = -1;
        var ZERO = 0x0030;
        var a = 0x0061;
        var e = 0x0065;
        var f = 0x0066;
        var u = 0x0075;
        var z = 0x007a;
        var A = 0x0041;
        var E = 0x0045;
        var F = 0x0046;
        var U = 0x0055;
        var Z = 0x005a;
        var isDigit = function (codePoint) { return codePoint >= ZERO && codePoint <= 0x0039; };
        var isSurrogateCodePoint = function (codePoint) { return codePoint >= 0xd800 && codePoint <= 0xdfff; };
        var isHex = function (codePoint) {
            return isDigit(codePoint) || (codePoint >= A && codePoint <= F) || (codePoint >= a && codePoint <= f);
        };
        var isLowerCaseLetter = function (codePoint) { return codePoint >= a && codePoint <= z; };
        var isUpperCaseLetter = function (codePoint) { return codePoint >= A && codePoint <= Z; };
        var isLetter = function (codePoint) { return isLowerCaseLetter(codePoint) || isUpperCaseLetter(codePoint); };
        var isNonASCIICodePoint = function (codePoint) { return codePoint >= CONTROL; };
        var isWhiteSpace = function (codePoint) {
            return codePoint === LINE_FEED || codePoint === CHARACTER_TABULATION || codePoint === SPACE;
        };
        var isNameStartCodePoint = function (codePoint) {
            return isLetter(codePoint) || isNonASCIICodePoint(codePoint) || codePoint === LOW_LINE;
        };
        var isNameCodePoint = function (codePoint) {
            return isNameStartCodePoint(codePoint) || isDigit(codePoint) || codePoint === HYPHEN_MINUS;
        };
        var isNonPrintableCodePoint = function (codePoint) {
            return ((codePoint >= NULL && codePoint <= BACKSPACE) ||
                codePoint === LINE_TABULATION ||
                (codePoint >= SHIFT_OUT && codePoint <= INFORMATION_SEPARATOR_ONE) ||
                codePoint === DELETE);
        };
        var isValidEscape = function (c1, c2) {
            if (c1 !== REVERSE_SOLIDUS) {
                return false;
            }
            return c2 !== LINE_FEED;
        };
        var isIdentifierStart = function (c1, c2, c3) {
            if (c1 === HYPHEN_MINUS) {
                return isNameStartCodePoint(c2) || isValidEscape(c2, c3);
            }
            else if (isNameStartCodePoint(c1)) {
                return true;
            }
            else if (c1 === REVERSE_SOLIDUS && isValidEscape(c1, c2)) {
                return true;
            }
            return false;
        };
        var isNumberStart = function (c1, c2, c3) {
            if (c1 === PLUS_SIGN || c1 === HYPHEN_MINUS) {
                if (isDigit(c2)) {
                    return true;
                }
                return c2 === FULL_STOP && isDigit(c3);
            }
            if (c1 === FULL_STOP) {
                return isDigit(c2);
            }
            return isDigit(c1);
        };
        var stringToNumber = function (codePoints) {
            var c = 0;
            var sign = 1;
            if (codePoints[c] === PLUS_SIGN || codePoints[c] === HYPHEN_MINUS) {
                if (codePoints[c] === HYPHEN_MINUS) {
                    sign = -1;
                }
                c++;
            }
            var integers = [];
            while (isDigit(codePoints[c])) {
                integers.push(codePoints[c++]);
            }
            var int = integers.length ? parseInt(fromCodePoint.apply(void 0, integers), 10) : 0;
            if (codePoints[c] === FULL_STOP) {
                c++;
            }
            var fraction = [];
            while (isDigit(codePoints[c])) {
                fraction.push(codePoints[c++]);
            }
            var fracd = fraction.length;
            var frac = fracd ? parseInt(fromCodePoint.apply(void 0, fraction), 10) : 0;
            if (codePoints[c] === E || codePoints[c] === e) {
                c++;
            }
            var expsign = 1;
            if (codePoints[c] === PLUS_SIGN || codePoints[c] === HYPHEN_MINUS) {
                if (codePoints[c] === HYPHEN_MINUS) {
                    expsign = -1;
                }
                c++;
            }
            var exponent = [];
            while (isDigit(codePoints[c])) {
                exponent.push(codePoints[c++]);
            }
            var exp = exponent.length ? parseInt(fromCodePoint.apply(void 0, exponent), 10) : 0;
            return sign * (int + frac * Math.pow(10, -fracd)) * Math.pow(10, expsign * exp);
        };
        var LEFT_PARENTHESIS_TOKEN = {
            type: TokenType.LEFT_PARENTHESIS_TOKEN
        };
        var RIGHT_PARENTHESIS_TOKEN = {
            type: TokenType.RIGHT_PARENTHESIS_TOKEN
        };
        var COMMA_TOKEN = { type: TokenType.COMMA_TOKEN };
        var SUFFIX_MATCH_TOKEN = { type: TokenType.SUFFIX_MATCH_TOKEN };
        var PREFIX_MATCH_TOKEN = { type: TokenType.PREFIX_MATCH_TOKEN };
        var COLUMN_TOKEN = { type: TokenType.COLUMN_TOKEN };
        var DASH_MATCH_TOKEN = { type: TokenType.DASH_MATCH_TOKEN };
        var INCLUDE_MATCH_TOKEN = { type: TokenType.INCLUDE_MATCH_TOKEN };
        var LEFT_CURLY_BRACKET_TOKEN = {
            type: TokenType.LEFT_CURLY_BRACKET_TOKEN
        };
        var RIGHT_CURLY_BRACKET_TOKEN = {
            type: TokenType.RIGHT_CURLY_BRACKET_TOKEN
        };
        var SUBSTRING_MATCH_TOKEN = { type: TokenType.SUBSTRING_MATCH_TOKEN };
        var BAD_URL_TOKEN = { type: TokenType.BAD_URL_TOKEN };
        var BAD_STRING_TOKEN = { type: TokenType.BAD_STRING_TOKEN };
        var CDO_TOKEN = { type: TokenType.CDO_TOKEN };
        var CDC_TOKEN = { type: TokenType.CDC_TOKEN };
        var COLON_TOKEN = { type: TokenType.COLON_TOKEN };
        var SEMICOLON_TOKEN = { type: TokenType.SEMICOLON_TOKEN };
        var LEFT_SQUARE_BRACKET_TOKEN = {
            type: TokenType.LEFT_SQUARE_BRACKET_TOKEN
        };
        var RIGHT_SQUARE_BRACKET_TOKEN = {
            type: TokenType.RIGHT_SQUARE_BRACKET_TOKEN
        };
        var WHITESPACE_TOKEN = { type: TokenType.WHITESPACE_TOKEN };
        var EOF_TOKEN = { type: TokenType.EOF_TOKEN };
        var Tokenizer = /** @class */ (function () {
            function Tokenizer() {
                this._value = [];
            }
            Tokenizer.prototype.write = function (chunk) {
                this._value = this._value.concat(toCodePoints(chunk));
            };
            Tokenizer.prototype.read = function () {
                var tokens = [];
                var token = this.consumeToken();
                while (token !== EOF_TOKEN) {
                    tokens.push(token);
                    token = this.consumeToken();
                }
                return tokens;
            };
            Tokenizer.prototype.consumeToken = function () {
                var codePoint = this.consumeCodePoint();
                switch (codePoint) {
                    case QUOTATION_MARK:
                        return this.consumeStringToken(QUOTATION_MARK);
                    case NUMBER_SIGN:
                        var c1 = this.peekCodePoint(0);
                        var c2 = this.peekCodePoint(1);
                        var c3 = this.peekCodePoint(2);
                        if (isNameCodePoint(c1) || isValidEscape(c2, c3)) {
                            var flags = isIdentifierStart(c1, c2, c3) ? FLAG_ID : FLAG_UNRESTRICTED;
                            var value = this.consumeName();
                            return { type: TokenType.HASH_TOKEN, value: value, flags: flags };
                        }
                        break;
                    case DOLLAR_SIGN:
                        if (this.peekCodePoint(0) === EQUALS_SIGN) {
                            this.consumeCodePoint();
                            return SUFFIX_MATCH_TOKEN;
                        }
                        break;
                    case APOSTROPHE:
                        return this.consumeStringToken(APOSTROPHE);
                    case LEFT_PARENTHESIS:
                        return LEFT_PARENTHESIS_TOKEN;
                    case RIGHT_PARENTHESIS:
                        return RIGHT_PARENTHESIS_TOKEN;
                    case ASTERISK:
                        if (this.peekCodePoint(0) === EQUALS_SIGN) {
                            this.consumeCodePoint();
                            return SUBSTRING_MATCH_TOKEN;
                        }
                        break;
                    case PLUS_SIGN:
                        if (isNumberStart(codePoint, this.peekCodePoint(0), this.peekCodePoint(1))) {
                            this.reconsumeCodePoint(codePoint);
                            return this.consumeNumericToken();
                        }
                        break;
                    case COMMA:
                        return COMMA_TOKEN;
                    case HYPHEN_MINUS:
                        var e1 = codePoint;
                        var e2 = this.peekCodePoint(0);
                        var e3 = this.peekCodePoint(1);
                        if (isNumberStart(e1, e2, e3)) {
                            this.reconsumeCodePoint(codePoint);
                            return this.consumeNumericToken();
                        }
                        if (isIdentifierStart(e1, e2, e3)) {
                            this.reconsumeCodePoint(codePoint);
                            return this.consumeIdentLikeToken();
                        }
                        if (e2 === HYPHEN_MINUS && e3 === GREATER_THAN_SIGN) {
                            this.consumeCodePoint();
                            this.consumeCodePoint();
                            return CDC_TOKEN;
                        }
                        break;
                    case FULL_STOP:
                        if (isNumberStart(codePoint, this.peekCodePoint(0), this.peekCodePoint(1))) {
                            this.reconsumeCodePoint(codePoint);
                            return this.consumeNumericToken();
                        }
                        break;
                    case SOLIDUS:
                        if (this.peekCodePoint(0) === ASTERISK) {
                            this.consumeCodePoint();
                            while (true) {
                                var c = this.consumeCodePoint();
                                if (c === ASTERISK) {
                                    c = this.consumeCodePoint();
                                    if (c === SOLIDUS) {
                                        return this.consumeToken();
                                    }
                                }
                                if (c === EOF) {
                                    return this.consumeToken();
                                }
                            }
                        }
                        break;
                    case COLON:
                        return COLON_TOKEN;
                    case SEMICOLON:
                        return SEMICOLON_TOKEN;
                    case LESS_THAN_SIGN:
                        if (this.peekCodePoint(0) === EXCLAMATION_MARK &&
                            this.peekCodePoint(1) === HYPHEN_MINUS &&
                            this.peekCodePoint(2) === HYPHEN_MINUS) {
                            this.consumeCodePoint();
                            this.consumeCodePoint();
                            return CDO_TOKEN;
                        }
                        break;
                    case COMMERCIAL_AT:
                        var a1 = this.peekCodePoint(0);
                        var a2 = this.peekCodePoint(1);
                        var a3 = this.peekCodePoint(2);
                        if (isIdentifierStart(a1, a2, a3)) {
                            var value = this.consumeName();
                            return { type: TokenType.AT_KEYWORD_TOKEN, value: value };
                        }
                        break;
                    case LEFT_SQUARE_BRACKET:
                        return LEFT_SQUARE_BRACKET_TOKEN;
                    case REVERSE_SOLIDUS:
                        if (isValidEscape(codePoint, this.peekCodePoint(0))) {
                            this.reconsumeCodePoint(codePoint);
                            return this.consumeIdentLikeToken();
                        }
                        break;
                    case RIGHT_SQUARE_BRACKET:
                        return RIGHT_SQUARE_BRACKET_TOKEN;
                    case CIRCUMFLEX_ACCENT:
                        if (this.peekCodePoint(0) === EQUALS_SIGN) {
                            this.consumeCodePoint();
                            return PREFIX_MATCH_TOKEN;
                        }
                        break;
                    case LEFT_CURLY_BRACKET:
                        return LEFT_CURLY_BRACKET_TOKEN;
                    case RIGHT_CURLY_BRACKET:
                        return RIGHT_CURLY_BRACKET_TOKEN;
                    case u:
                    case U:
                        var u1 = this.peekCodePoint(0);
                        var u2 = this.peekCodePoint(1);
                        if (u1 === PLUS_SIGN && (isHex(u2) || u2 === QUESTION_MARK)) {
                            this.consumeCodePoint();
                            this.consumeUnicodeRangeToken();
                        }
                        this.reconsumeCodePoint(codePoint);
                        return this.consumeIdentLikeToken();
                    case VERTICAL_LINE:
                        if (this.peekCodePoint(0) === EQUALS_SIGN) {
                            this.consumeCodePoint();
                            return DASH_MATCH_TOKEN;
                        }
                        if (this.peekCodePoint(0) === VERTICAL_LINE) {
                            this.consumeCodePoint();
                            return COLUMN_TOKEN;
                        }
                        break;
                    case TILDE:
                        if (this.peekCodePoint(0) === EQUALS_SIGN) {
                            this.consumeCodePoint();
                            return INCLUDE_MATCH_TOKEN;
                        }
                        break;
                    case EOF:
                        return EOF_TOKEN;
                }
                if (isWhiteSpace(codePoint)) {
                    this.consumeWhiteSpace();
                    return WHITESPACE_TOKEN;
                }
                if (isDigit(codePoint)) {
                    this.reconsumeCodePoint(codePoint);
                    return this.consumeNumericToken();
                }
                if (isNameStartCodePoint(codePoint)) {
                    this.reconsumeCodePoint(codePoint);
                    return this.consumeIdentLikeToken();
                }
                return { type: TokenType.DELIM_TOKEN, value: fromCodePoint(codePoint) };
            };
            Tokenizer.prototype.consumeCodePoint = function () {
                var value = this._value.shift();
                return typeof value === 'undefined' ? -1 : value;
            };
            Tokenizer.prototype.reconsumeCodePoint = function (codePoint) {
                this._value.unshift(codePoint);
            };
            Tokenizer.prototype.peekCodePoint = function (delta) {
                if (delta >= this._value.length) {
                    return -1;
                }
                return this._value[delta];
            };
            Tokenizer.prototype.consumeUnicodeRangeToken = function () {
                var digits = [];
                var codePoint = this.consumeCodePoint();
                while (isHex(codePoint) && digits.length < 6) {
                    digits.push(codePoint);
                    codePoint = this.consumeCodePoint();
                }
                var questionMarks = false;
                while (codePoint === QUESTION_MARK && digits.length < 6) {
                    digits.push(codePoint);
                    codePoint = this.consumeCodePoint();
                    questionMarks = true;
                }
                if (questionMarks) {
                    var start_1 = parseInt(fromCodePoint.apply(void 0, digits.map(function (digit) { return (digit === QUESTION_MARK ? ZERO : digit); })), 16);
                    var end = parseInt(fromCodePoint.apply(void 0, digits.map(function (digit) { return (digit === QUESTION_MARK ? F : digit); })), 16);
                    return { type: TokenType.UNICODE_RANGE_TOKEN, start: start_1, end: end };
                }
                var start = parseInt(fromCodePoint.apply(void 0, digits), 16);
                if (this.peekCodePoint(0) === HYPHEN_MINUS && isHex(this.peekCodePoint(1))) {
                    this.consumeCodePoint();
                    codePoint = this.consumeCodePoint();
                    var endDigits = [];
                    while (isHex(codePoint) && endDigits.length < 6) {
                        endDigits.push(codePoint);
                        codePoint = this.consumeCodePoint();
                    }
                    var end = parseInt(fromCodePoint.apply(void 0, endDigits), 16);
                    return { type: TokenType.UNICODE_RANGE_TOKEN, start: start, end: end };
                }
                else {
                    return { type: TokenType.UNICODE_RANGE_TOKEN, start: start, end: start };
                }
            };
            Tokenizer.prototype.consumeIdentLikeToken = function () {
                var value = this.consumeName();
                if (value.toLowerCase() === 'url' && this.peekCodePoint(0) === LEFT_PARENTHESIS) {
                    this.consumeCodePoint();
                    return this.consumeUrlToken();
                }
                else if (this.peekCodePoint(0) === LEFT_PARENTHESIS) {
                    this.consumeCodePoint();
                    return { type: TokenType.FUNCTION_TOKEN, value: value };
                }
                return { type: TokenType.IDENT_TOKEN, value: value };
            };
            Tokenizer.prototype.consumeUrlToken = function () {
                var value = [];
                this.consumeWhiteSpace();
                if (this.peekCodePoint(0) === EOF) {
                    return { type: TokenType.URL_TOKEN, value: '' };
                }
                var next = this.peekCodePoint(0);
                if (next === APOSTROPHE || next === QUOTATION_MARK) {
                    var stringToken = this.consumeStringToken(this.consumeCodePoint());
                    if (stringToken.type === TokenType.STRING_TOKEN) {
                        this.consumeWhiteSpace();
                        if (this.peekCodePoint(0) === EOF || this.peekCodePoint(0) === RIGHT_PARENTHESIS) {
                            this.consumeCodePoint();
                            return { type: TokenType.URL_TOKEN, value: stringToken.value };
                        }
                    }
                    this.consumeBadUrlRemnants();
                    return BAD_URL_TOKEN;
                }
                while (true) {
                    var codePoint = this.consumeCodePoint();
                    if (codePoint === EOF || codePoint === RIGHT_PARENTHESIS) {
                        return { type: TokenType.URL_TOKEN, value: fromCodePoint.apply(void 0, value) };
                    }
                    else if (isWhiteSpace(codePoint)) {
                        this.consumeWhiteSpace();
                        if (this.peekCodePoint(0) === EOF || this.peekCodePoint(0) === RIGHT_PARENTHESIS) {
                            this.consumeCodePoint();
                            return { type: TokenType.URL_TOKEN, value: fromCodePoint.apply(void 0, value) };
                        }
                        this.consumeBadUrlRemnants();
                        return BAD_URL_TOKEN;
                    }
                    else if (codePoint === QUOTATION_MARK ||
                        codePoint === APOSTROPHE ||
                        codePoint === LEFT_PARENTHESIS ||
                        isNonPrintableCodePoint(codePoint)) {
                        this.consumeBadUrlRemnants();
                        return BAD_URL_TOKEN;
                    }
                    else if (codePoint === REVERSE_SOLIDUS) {
                        if (isValidEscape(codePoint, this.peekCodePoint(0))) {
                            value.push(this.consumeEscapedCodePoint());
                        }
                        else {
                            this.consumeBadUrlRemnants();
                            return BAD_URL_TOKEN;
                        }
                    }
                    else {
                        value.push(codePoint);
                    }
                }
            };
            Tokenizer.prototype.consumeWhiteSpace = function () {
                while (isWhiteSpace(this.peekCodePoint(0))) {
                    this.consumeCodePoint();
                }
            };
            Tokenizer.prototype.consumeBadUrlRemnants = function () {
                while (true) {
                    var codePoint = this.consumeCodePoint();
                    if (codePoint === RIGHT_PARENTHESIS || codePoint === EOF) {
                        return;
                    }
                    if (isValidEscape(codePoint, this.peekCodePoint(0))) {
                        this.consumeEscapedCodePoint();
                    }
                }
            };
            Tokenizer.prototype.consumeStringSlice = function (count) {
                var SLICE_STACK_SIZE = 60000;
                var value = '';
                while (count > 0) {
                    var amount = Math.min(SLICE_STACK_SIZE, count);
                    value += fromCodePoint.apply(void 0, this._value.splice(0, amount));
                    count -= amount;
                }
                this._value.shift();
                return value;
            };
            Tokenizer.prototype.consumeStringToken = function (endingCodePoint) {
                var value = '';
                var i = 0;
                do {
                    var codePoint = this._value[i];
                    if (codePoint === EOF || codePoint === undefined || codePoint === endingCodePoint) {
                        value += this.consumeStringSlice(i);
                        return { type: TokenType.STRING_TOKEN, value: value };
                    }
                    if (codePoint === LINE_FEED) {
                        this._value.splice(0, i);
                        return BAD_STRING_TOKEN;
                    }
                    if (codePoint === REVERSE_SOLIDUS) {
                        var next = this._value[i + 1];
                        if (next !== EOF && next !== undefined) {
                            if (next === LINE_FEED) {
                                value += this.consumeStringSlice(i);
                                i = -1;
                                this._value.shift();
                            }
                            else if (isValidEscape(codePoint, next)) {
                                value += this.consumeStringSlice(i);
                                value += fromCodePoint(this.consumeEscapedCodePoint());
                                i = -1;
                            }
                        }
                    }
                    i++;
                } while (true);
            };
            Tokenizer.prototype.consumeNumber = function () {
                var repr = [];
                var type = FLAG_INTEGER;
                var c1 = this.peekCodePoint(0);
                if (c1 === PLUS_SIGN || c1 === HYPHEN_MINUS) {
                    repr.push(this.consumeCodePoint());
                }
                while (isDigit(this.peekCodePoint(0))) {
                    repr.push(this.consumeCodePoint());
                }
                c1 = this.peekCodePoint(0);
                var c2 = this.peekCodePoint(1);
                if (c1 === FULL_STOP && isDigit(c2)) {
                    repr.push(this.consumeCodePoint(), this.consumeCodePoint());
                    type = FLAG_NUMBER;
                    while (isDigit(this.peekCodePoint(0))) {
                        repr.push(this.consumeCodePoint());
                    }
                }
                c1 = this.peekCodePoint(0);
                c2 = this.peekCodePoint(1);
                var c3 = this.peekCodePoint(2);
                if ((c1 === E || c1 === e) && (((c2 === PLUS_SIGN || c2 === HYPHEN_MINUS) && isDigit(c3)) || isDigit(c2))) {
                    repr.push(this.consumeCodePoint(), this.consumeCodePoint());
                    type = FLAG_NUMBER;
                    while (isDigit(this.peekCodePoint(0))) {
                        repr.push(this.consumeCodePoint());
                    }
                }
                return [stringToNumber(repr), type];
            };
            Tokenizer.prototype.consumeNumericToken = function () {
                var _a = this.consumeNumber(), number = _a[0], flags = _a[1];
                var c1 = this.peekCodePoint(0);
                var c2 = this.peekCodePoint(1);
                var c3 = this.peekCodePoint(2);
                if (isIdentifierStart(c1, c2, c3)) {
                    var unit = this.consumeName();
                    return { type: TokenType.DIMENSION_TOKEN, number: number, flags: flags, unit: unit };
                }
                if (c1 === PERCENTAGE_SIGN) {
                    this.consumeCodePoint();
                    return { type: TokenType.PERCENTAGE_TOKEN, number: number, flags: flags };
                }
                return { type: TokenType.NUMBER_TOKEN, number: number, flags: flags };
            };
            Tokenizer.prototype.consumeEscapedCodePoint = function () {
                var codePoint = this.consumeCodePoint();
                if (isHex(codePoint)) {
                    var hex = fromCodePoint(codePoint);
                    while (isHex(this.peekCodePoint(0)) && hex.length < 6) {
                        hex += fromCodePoint(this.consumeCodePoint());
                    }
                    if (isWhiteSpace(this.peekCodePoint(0))) {
                        this.consumeCodePoint();
                    }
                    var hexCodePoint = parseInt(hex, 16);
                    if (hexCodePoint === 0 || isSurrogateCodePoint(hexCodePoint) || hexCodePoint > 0x10ffff) {
                        return REPLACEMENT_CHARACTER;
                    }
                    return hexCodePoint;
                }
                if (codePoint === EOF) {
                    return REPLACEMENT_CHARACTER;
                }
                return codePoint;
            };
            Tokenizer.prototype.consumeName = function () {
                var result = '';
                while (true) {
                    var codePoint = this.consumeCodePoint();
                    if (isNameCodePoint(codePoint)) {
                        result += fromCodePoint(codePoint);
                    }
                    else if (isValidEscape(codePoint, this.peekCodePoint(0))) {
                        result += fromCodePoint(this.consumeEscapedCodePoint());
                    }
                    else {
                        this.reconsumeCodePoint(codePoint);
                        return result;
                    }
                }
            };
            return Tokenizer;
        }());

        var Parser = /** @class */ (function () {
            function Parser(tokens) {
                this._tokens = tokens;
            }
            Parser.create = function (value) {
                var tokenizer = new Tokenizer();
                tokenizer.write(value);
                return new Parser(tokenizer.read());
            };
            Parser.parseValue = function (value) {
                return Parser.create(value).parseComponentValue();
            };
            Parser.parseValues = function (value) {
                return Parser.create(value).parseComponentValues();
            };
            Parser.prototype.parseComponentValue = function () {
                var token = this.consumeToken();
                while (token.type === TokenType.WHITESPACE_TOKEN) {
                    token = this.consumeToken();
                }
                if (token.type === TokenType.EOF_TOKEN) {
                    throw new SyntaxError("Error parsing CSS component value, unexpected EOF");
                }
                this.reconsumeToken(token);
                var value = this.consumeComponentValue();
                do {
                    token = this.consumeToken();
                } while (token.type === TokenType.WHITESPACE_TOKEN);
                if (token.type === TokenType.EOF_TOKEN) {
                    return value;
                }
                throw new SyntaxError("Error parsing CSS component value, multiple values found when expecting only one");
            };
            Parser.prototype.parseComponentValues = function () {
                var values = [];
                while (true) {
                    var value = this.consumeComponentValue();
                    if (value.type === TokenType.EOF_TOKEN) {
                        return values;
                    }
                    values.push(value);
                    values.push();
                }
            };
            Parser.prototype.consumeComponentValue = function () {
                var token = this.consumeToken();
                switch (token.type) {
                    case TokenType.LEFT_CURLY_BRACKET_TOKEN:
                    case TokenType.LEFT_SQUARE_BRACKET_TOKEN:
                    case TokenType.LEFT_PARENTHESIS_TOKEN:
                        return this.consumeSimpleBlock(token.type);
                    case TokenType.FUNCTION_TOKEN:
                        return this.consumeFunction(token);
                }
                return token;
            };
            Parser.prototype.consumeSimpleBlock = function (type) {
                var block = { type: type, values: [] };
                var token = this.consumeToken();
                while (true) {
                    if (token.type === TokenType.EOF_TOKEN || isEndingTokenFor(token, type)) {
                        return block;
                    }
                    this.reconsumeToken(token);
                    block.values.push(this.consumeComponentValue());
                    token = this.consumeToken();
                }
            };
            Parser.prototype.consumeFunction = function (functionToken) {
                var cssFunction = {
                    name: functionToken.value,
                    values: [],
                    type: TokenType.FUNCTION
                };
                while (true) {
                    var token = this.consumeToken();
                    if (token.type === TokenType.EOF_TOKEN || token.type === TokenType.RIGHT_PARENTHESIS_TOKEN) {
                        return cssFunction;
                    }
                    this.reconsumeToken(token);
                    cssFunction.values.push(this.consumeComponentValue());
                }
            };
            Parser.prototype.consumeToken = function () {
                var token = this._tokens.shift();
                return typeof token === 'undefined' ? EOF_TOKEN : token;
            };
            Parser.prototype.reconsumeToken = function (token) {
                this._tokens.unshift(token);
            };
            return Parser;
        }());
        var isDimensionToken = function (token) { return token.type === TokenType.DIMENSION_TOKEN; };
        var isNumberToken = function (token) { return token.type === TokenType.NUMBER_TOKEN; };
        var isIdentToken = function (token) { return token.type === TokenType.IDENT_TOKEN; };
        var isStringToken = function (token) { return token.type === TokenType.STRING_TOKEN; };
        var isIdentWithValue = function (token, value) {
            return isIdentToken(token) && token.value === value;
        };
        var nonWhiteSpace = function (token) { return token.type !== TokenType.WHITESPACE_TOKEN; };
        var nonFunctionArgSeparator = function (token) {
            return token.type !== TokenType.WHITESPACE_TOKEN && token.type !== TokenType.COMMA_TOKEN;
        };
        var parseFunctionArgs = function (tokens) {
            var args = [];
            var arg = [];
            tokens.forEach(function (token) {
                if (token.type === TokenType.COMMA_TOKEN) {
                    if (arg.length === 0) {
                        throw new Error("Error parsing function args, zero tokens for arg");
                    }
                    args.push(arg);
                    arg = [];
                    return;
                }
                if (token.type !== TokenType.WHITESPACE_TOKEN) {
                    arg.push(token);
                }
            });
            if (arg.length) {
                args.push(arg);
            }
            return args;
        };
        var isEndingTokenFor = function (token, type) {
            if (type === TokenType.LEFT_CURLY_BRACKET_TOKEN && token.type === TokenType.RIGHT_CURLY_BRACKET_TOKEN) {
                return true;
            }
            if (type === TokenType.LEFT_SQUARE_BRACKET_TOKEN && token.type === TokenType.RIGHT_SQUARE_BRACKET_TOKEN) {
                return true;
            }
            return type === TokenType.LEFT_PARENTHESIS_TOKEN && token.type === TokenType.RIGHT_PARENTHESIS_TOKEN;
        };

        var isLength = function (token) {
            return token.type === TokenType.NUMBER_TOKEN || token.type === TokenType.DIMENSION_TOKEN;
        };

        var isLengthPercentage = function (token) {
            return token.type === TokenType.PERCENTAGE_TOKEN || isLength(token);
        };
        var parseLengthPercentageTuple = function (tokens) {
            return tokens.length > 1 ? [tokens[0], tokens[1]] : [tokens[0]];
        };
        var ZERO_LENGTH = {
            type: TokenType.NUMBER_TOKEN,
            number: 0,
            flags: FLAG_INTEGER
        };
        var FIFTY_PERCENT = {
            type: TokenType.PERCENTAGE_TOKEN,
            number: 50,
            flags: FLAG_INTEGER
        };
        var HUNDRED_PERCENT = {
            type: TokenType.PERCENTAGE_TOKEN,
            number: 100,
            flags: FLAG_INTEGER
        };
        var getAbsoluteValueForTuple = function (tuple, width, height) {
            var x = tuple[0], y = tuple[1];
            return [getAbsoluteValue(x, width), getAbsoluteValue(typeof y !== 'undefined' ? y : x, height)];
        };
        var getAbsoluteValue = function (token, parent) {
            if (token.type === TokenType.PERCENTAGE_TOKEN) {
                return (token.number / 100) * parent;
            }
            if (isDimensionToken(token)) {
                switch (token.unit) {
                    case 'rem':
                    case 'em':
                        return 16 * token.number; // TODO use correct font-size
                    case 'px':
                    default:
                        return token.number;
                }
            }
            return token.number;
        };

        var DEG = 'deg';
        var GRAD = 'grad';
        var RAD = 'rad';
        var TURN = 'turn';
        var angle = {
            name: 'angle',
            parse: function (value) {
                if (value.type === TokenType.DIMENSION_TOKEN) {
                    switch (value.unit) {
                        case DEG:
                            return (Math.PI * value.number) / 180;
                        case GRAD:
                            return (Math.PI / 200) * value.number;
                        case RAD:
                            return value.number;
                        case TURN:
                            return Math.PI * 2 * value.number;
                    }
                }
                throw new Error("Unsupported angle type");
            }
        };
        var isAngle = function (value) {
            if (value.type === TokenType.DIMENSION_TOKEN) {
                if (value.unit === DEG || value.unit === GRAD || value.unit === RAD || value.unit === TURN) {
                    return true;
                }
            }
            return false;
        };
        var parseNamedSide = function (tokens) {
            var sideOrCorner = tokens
                .filter(isIdentToken)
                .map(function (ident) { return ident.value; })
                .join(' ');
            switch (sideOrCorner) {
                case 'to bottom right':
                case 'to right bottom':
                case 'left top':
                case 'top left':
                    return [ZERO_LENGTH, ZERO_LENGTH];
                case 'to top':
                case 'bottom':
                    return deg(0);
                case 'to bottom left':
                case 'to left bottom':
                case 'right top':
                case 'top right':
                    return [ZERO_LENGTH, HUNDRED_PERCENT];
                case 'to right':
                case 'left':
                    return deg(90);
                case 'to top left':
                case 'to left top':
                case 'right bottom':
                case 'bottom right':
                    return [HUNDRED_PERCENT, HUNDRED_PERCENT];
                case 'to bottom':
                case 'top':
                    return deg(180);
                case 'to top right':
                case 'to right top':
                case 'left bottom':
                case 'bottom left':
                    return [HUNDRED_PERCENT, ZERO_LENGTH];
                case 'to left':
                case 'right':
                    return deg(270);
            }
            return 0;
        };
        var deg = function (deg) { return (Math.PI * deg) / 180; };

        var color$1 = {
            name: 'color',
            parse: function (value) {
                if (value.type === TokenType.FUNCTION) {
                    var colorFunction = SUPPORTED_COLOR_FUNCTIONS[value.name];
                    if (typeof colorFunction === 'undefined') {
                        throw new Error("Attempting to parse an unsupported color function \"" + value.name + "\"");
                    }
                    return colorFunction(value.values);
                }
                if (value.type === TokenType.HASH_TOKEN) {
                    if (value.value.length === 3) {
                        var r = value.value.substring(0, 1);
                        var g = value.value.substring(1, 2);
                        var b = value.value.substring(2, 3);
                        return pack(parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16), 1);
                    }
                    if (value.value.length === 4) {
                        var r = value.value.substring(0, 1);
                        var g = value.value.substring(1, 2);
                        var b = value.value.substring(2, 3);
                        var a = value.value.substring(3, 4);
                        return pack(parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16), parseInt(a + a, 16) / 255);
                    }
                    if (value.value.length === 6) {
                        var r = value.value.substring(0, 2);
                        var g = value.value.substring(2, 4);
                        var b = value.value.substring(4, 6);
                        return pack(parseInt(r, 16), parseInt(g, 16), parseInt(b, 16), 1);
                    }
                    if (value.value.length === 8) {
                        var r = value.value.substring(0, 2);
                        var g = value.value.substring(2, 4);
                        var b = value.value.substring(4, 6);
                        var a = value.value.substring(6, 8);
                        return pack(parseInt(r, 16), parseInt(g, 16), parseInt(b, 16), parseInt(a, 16) / 255);
                    }
                }
                if (value.type === TokenType.IDENT_TOKEN) {
                    var namedColor = COLORS[value.value.toUpperCase()];
                    if (typeof namedColor !== 'undefined') {
                        return namedColor;
                    }
                }
                return COLORS.TRANSPARENT;
            }
        };
        var isTransparent = function (color) { return (0xff & color) === 0; };
        var asString = function (color) {
            var alpha = 0xff & color;
            var blue = 0xff & (color >> 8);
            var green = 0xff & (color >> 16);
            var red = 0xff & (color >> 24);
            return alpha < 255 ? "rgba(" + red + "," + green + "," + blue + "," + alpha / 255 + ")" : "rgb(" + red + "," + green + "," + blue + ")";
        };
        var pack = function (r, g, b, a) {
            return ((r << 24) | (g << 16) | (b << 8) | (Math.round(a * 255) << 0)) >>> 0;
        };
        var getTokenColorValue = function (token, i) {
            if (token.type === TokenType.NUMBER_TOKEN) {
                return token.number;
            }
            if (token.type === TokenType.PERCENTAGE_TOKEN) {
                var max = i === 3 ? 1 : 255;
                return i === 3 ? (token.number / 100) * max : Math.round((token.number / 100) * max);
            }
            return 0;
        };
        var rgb = function (args) {
            var tokens = args.filter(nonFunctionArgSeparator);
            if (tokens.length === 3) {
                var _a = tokens.map(getTokenColorValue), r = _a[0], g = _a[1], b = _a[2];
                return pack(r, g, b, 1);
            }
            if (tokens.length === 4) {
                var _b = tokens.map(getTokenColorValue), r = _b[0], g = _b[1], b = _b[2], a = _b[3];
                return pack(r, g, b, a);
            }
            return 0;
        };
        function hue2rgb(t1, t2, hue) {
            if (hue < 0) {
                hue += 1;
            }
            if (hue >= 1) {
                hue -= 1;
            }
            if (hue < 1 / 6) {
                return (t2 - t1) * hue * 6 + t1;
            }
            else if (hue < 1 / 2) {
                return t2;
            }
            else if (hue < 2 / 3) {
                return (t2 - t1) * 6 * (2 / 3 - hue) + t1;
            }
            else {
                return t1;
            }
        }
        var hsl = function (args) {
            var tokens = args.filter(nonFunctionArgSeparator);
            var hue = tokens[0], saturation = tokens[1], lightness = tokens[2], alpha = tokens[3];
            var h = (hue.type === TokenType.NUMBER_TOKEN ? deg(hue.number) : angle.parse(hue)) / (Math.PI * 2);
            var s = isLengthPercentage(saturation) ? saturation.number / 100 : 0;
            var l = isLengthPercentage(lightness) ? lightness.number / 100 : 0;
            var a = typeof alpha !== 'undefined' && isLengthPercentage(alpha) ? getAbsoluteValue(alpha, 1) : 1;
            if (s === 0) {
                return pack(l * 255, l * 255, l * 255, 1);
            }
            var t2 = l <= 0.5 ? l * (s + 1) : l + s - l * s;
            var t1 = l * 2 - t2;
            var r = hue2rgb(t1, t2, h + 1 / 3);
            var g = hue2rgb(t1, t2, h);
            var b = hue2rgb(t1, t2, h - 1 / 3);
            return pack(r * 255, g * 255, b * 255, a);
        };
        var SUPPORTED_COLOR_FUNCTIONS = {
            hsl: hsl,
            hsla: hsl,
            rgb: rgb,
            rgba: rgb
        };
        var COLORS = {
            ALICEBLUE: 0xf0f8ffff,
            ANTIQUEWHITE: 0xfaebd7ff,
            AQUA: 0x00ffffff,
            AQUAMARINE: 0x7fffd4ff,
            AZURE: 0xf0ffffff,
            BEIGE: 0xf5f5dcff,
            BISQUE: 0xffe4c4ff,
            BLACK: 0x000000ff,
            BLANCHEDALMOND: 0xffebcdff,
            BLUE: 0x0000ffff,
            BLUEVIOLET: 0x8a2be2ff,
            BROWN: 0xa52a2aff,
            BURLYWOOD: 0xdeb887ff,
            CADETBLUE: 0x5f9ea0ff,
            CHARTREUSE: 0x7fff00ff,
            CHOCOLATE: 0xd2691eff,
            CORAL: 0xff7f50ff,
            CORNFLOWERBLUE: 0x6495edff,
            CORNSILK: 0xfff8dcff,
            CRIMSON: 0xdc143cff,
            CYAN: 0x00ffffff,
            DARKBLUE: 0x00008bff,
            DARKCYAN: 0x008b8bff,
            DARKGOLDENROD: 0xb886bbff,
            DARKGRAY: 0xa9a9a9ff,
            DARKGREEN: 0x006400ff,
            DARKGREY: 0xa9a9a9ff,
            DARKKHAKI: 0xbdb76bff,
            DARKMAGENTA: 0x8b008bff,
            DARKOLIVEGREEN: 0x556b2fff,
            DARKORANGE: 0xff8c00ff,
            DARKORCHID: 0x9932ccff,
            DARKRED: 0x8b0000ff,
            DARKSALMON: 0xe9967aff,
            DARKSEAGREEN: 0x8fbc8fff,
            DARKSLATEBLUE: 0x483d8bff,
            DARKSLATEGRAY: 0x2f4f4fff,
            DARKSLATEGREY: 0x2f4f4fff,
            DARKTURQUOISE: 0x00ced1ff,
            DARKVIOLET: 0x9400d3ff,
            DEEPPINK: 0xff1493ff,
            DEEPSKYBLUE: 0x00bfffff,
            DIMGRAY: 0x696969ff,
            DIMGREY: 0x696969ff,
            DODGERBLUE: 0x1e90ffff,
            FIREBRICK: 0xb22222ff,
            FLORALWHITE: 0xfffaf0ff,
            FORESTGREEN: 0x228b22ff,
            FUCHSIA: 0xff00ffff,
            GAINSBORO: 0xdcdcdcff,
            GHOSTWHITE: 0xf8f8ffff,
            GOLD: 0xffd700ff,
            GOLDENROD: 0xdaa520ff,
            GRAY: 0x808080ff,
            GREEN: 0x008000ff,
            GREENYELLOW: 0xadff2fff,
            GREY: 0x808080ff,
            HONEYDEW: 0xf0fff0ff,
            HOTPINK: 0xff69b4ff,
            INDIANRED: 0xcd5c5cff,
            INDIGO: 0x4b0082ff,
            IVORY: 0xfffff0ff,
            KHAKI: 0xf0e68cff,
            LAVENDER: 0xe6e6faff,
            LAVENDERBLUSH: 0xfff0f5ff,
            LAWNGREEN: 0x7cfc00ff,
            LEMONCHIFFON: 0xfffacdff,
            LIGHTBLUE: 0xadd8e6ff,
            LIGHTCORAL: 0xf08080ff,
            LIGHTCYAN: 0xe0ffffff,
            LIGHTGOLDENRODYELLOW: 0xfafad2ff,
            LIGHTGRAY: 0xd3d3d3ff,
            LIGHTGREEN: 0x90ee90ff,
            LIGHTGREY: 0xd3d3d3ff,
            LIGHTPINK: 0xffb6c1ff,
            LIGHTSALMON: 0xffa07aff,
            LIGHTSEAGREEN: 0x20b2aaff,
            LIGHTSKYBLUE: 0x87cefaff,
            LIGHTSLATEGRAY: 0x778899ff,
            LIGHTSLATEGREY: 0x778899ff,
            LIGHTSTEELBLUE: 0xb0c4deff,
            LIGHTYELLOW: 0xffffe0ff,
            LIME: 0x00ff00ff,
            LIMEGREEN: 0x32cd32ff,
            LINEN: 0xfaf0e6ff,
            MAGENTA: 0xff00ffff,
            MAROON: 0x800000ff,
            MEDIUMAQUAMARINE: 0x66cdaaff,
            MEDIUMBLUE: 0x0000cdff,
            MEDIUMORCHID: 0xba55d3ff,
            MEDIUMPURPLE: 0x9370dbff,
            MEDIUMSEAGREEN: 0x3cb371ff,
            MEDIUMSLATEBLUE: 0x7b68eeff,
            MEDIUMSPRINGGREEN: 0x00fa9aff,
            MEDIUMTURQUOISE: 0x48d1ccff,
            MEDIUMVIOLETRED: 0xc71585ff,
            MIDNIGHTBLUE: 0x191970ff,
            MINTCREAM: 0xf5fffaff,
            MISTYROSE: 0xffe4e1ff,
            MOCCASIN: 0xffe4b5ff,
            NAVAJOWHITE: 0xffdeadff,
            NAVY: 0x000080ff,
            OLDLACE: 0xfdf5e6ff,
            OLIVE: 0x808000ff,
            OLIVEDRAB: 0x6b8e23ff,
            ORANGE: 0xffa500ff,
            ORANGERED: 0xff4500ff,
            ORCHID: 0xda70d6ff,
            PALEGOLDENROD: 0xeee8aaff,
            PALEGREEN: 0x98fb98ff,
            PALETURQUOISE: 0xafeeeeff,
            PALEVIOLETRED: 0xdb7093ff,
            PAPAYAWHIP: 0xffefd5ff,
            PEACHPUFF: 0xffdab9ff,
            PERU: 0xcd853fff,
            PINK: 0xffc0cbff,
            PLUM: 0xdda0ddff,
            POWDERBLUE: 0xb0e0e6ff,
            PURPLE: 0x800080ff,
            REBECCAPURPLE: 0x663399ff,
            RED: 0xff0000ff,
            ROSYBROWN: 0xbc8f8fff,
            ROYALBLUE: 0x4169e1ff,
            SADDLEBROWN: 0x8b4513ff,
            SALMON: 0xfa8072ff,
            SANDYBROWN: 0xf4a460ff,
            SEAGREEN: 0x2e8b57ff,
            SEASHELL: 0xfff5eeff,
            SIENNA: 0xa0522dff,
            SILVER: 0xc0c0c0ff,
            SKYBLUE: 0x87ceebff,
            SLATEBLUE: 0x6a5acdff,
            SLATEGRAY: 0x708090ff,
            SLATEGREY: 0x708090ff,
            SNOW: 0xfffafaff,
            SPRINGGREEN: 0x00ff7fff,
            STEELBLUE: 0x4682b4ff,
            TAN: 0xd2b48cff,
            TEAL: 0x008080ff,
            THISTLE: 0xd8bfd8ff,
            TOMATO: 0xff6347ff,
            TRANSPARENT: 0x00000000,
            TURQUOISE: 0x40e0d0ff,
            VIOLET: 0xee82eeff,
            WHEAT: 0xf5deb3ff,
            WHITE: 0xffffffff,
            WHITESMOKE: 0xf5f5f5ff,
            YELLOW: 0xffff00ff,
            YELLOWGREEN: 0x9acd32ff
        };

        var PropertyDescriptorParsingType;
        (function (PropertyDescriptorParsingType) {
            PropertyDescriptorParsingType[PropertyDescriptorParsingType["VALUE"] = 0] = "VALUE";
            PropertyDescriptorParsingType[PropertyDescriptorParsingType["LIST"] = 1] = "LIST";
            PropertyDescriptorParsingType[PropertyDescriptorParsingType["IDENT_VALUE"] = 2] = "IDENT_VALUE";
            PropertyDescriptorParsingType[PropertyDescriptorParsingType["TYPE_VALUE"] = 3] = "TYPE_VALUE";
            PropertyDescriptorParsingType[PropertyDescriptorParsingType["TOKEN_VALUE"] = 4] = "TOKEN_VALUE";
        })(PropertyDescriptorParsingType || (PropertyDescriptorParsingType = {}));

        var BACKGROUND_CLIP;
        (function (BACKGROUND_CLIP) {
            BACKGROUND_CLIP[BACKGROUND_CLIP["BORDER_BOX"] = 0] = "BORDER_BOX";
            BACKGROUND_CLIP[BACKGROUND_CLIP["PADDING_BOX"] = 1] = "PADDING_BOX";
            BACKGROUND_CLIP[BACKGROUND_CLIP["CONTENT_BOX"] = 2] = "CONTENT_BOX";
        })(BACKGROUND_CLIP || (BACKGROUND_CLIP = {}));
        var backgroundClip = {
            name: 'background-clip',
            initialValue: 'border-box',
            prefix: false,
            type: PropertyDescriptorParsingType.LIST,
            parse: function (tokens) {
                return tokens.map(function (token) {
                    if (isIdentToken(token)) {
                        switch (token.value) {
                            case 'padding-box':
                                return BACKGROUND_CLIP.PADDING_BOX;
                            case 'content-box':
                                return BACKGROUND_CLIP.CONTENT_BOX;
                        }
                    }
                    return BACKGROUND_CLIP.BORDER_BOX;
                });
            }
        };

        var backgroundColor = {
            name: "background-color",
            initialValue: 'transparent',
            prefix: false,
            type: PropertyDescriptorParsingType.TYPE_VALUE,
            format: 'color'
        };

        var parseColorStop = function (args) {
            var color = color$1.parse(args[0]);
            var stop = args[1];
            return stop && isLengthPercentage(stop) ? { color: color, stop: stop } : { color: color, stop: null };
        };
        var processColorStops = function (stops, lineLength) {
            var first = stops[0];
            var last = stops[stops.length - 1];
            if (first.stop === null) {
                first.stop = ZERO_LENGTH;
            }
            if (last.stop === null) {
                last.stop = HUNDRED_PERCENT;
            }
            var processStops = [];
            var previous = 0;
            for (var i = 0; i < stops.length; i++) {
                var stop_1 = stops[i].stop;
                if (stop_1 !== null) {
                    var absoluteValue = getAbsoluteValue(stop_1, lineLength);
                    if (absoluteValue > previous) {
                        processStops.push(absoluteValue);
                    }
                    else {
                        processStops.push(previous);
                    }
                    previous = absoluteValue;
                }
                else {
                    processStops.push(null);
                }
            }
            var gapBegin = null;
            for (var i = 0; i < processStops.length; i++) {
                var stop_2 = processStops[i];
                if (stop_2 === null) {
                    if (gapBegin === null) {
                        gapBegin = i;
                    }
                }
                else if (gapBegin !== null) {
                    var gapLength = i - gapBegin;
                    var beforeGap = processStops[gapBegin - 1];
                    var gapValue = (stop_2 - beforeGap) / (gapLength + 1);
                    for (var g = 1; g <= gapLength; g++) {
                        processStops[gapBegin + g - 1] = gapValue * g;
                    }
                    gapBegin = null;
                }
            }
            return stops.map(function (_a, i) {
                var color = _a.color;
                return { color: color, stop: Math.max(Math.min(1, processStops[i] / lineLength), 0) };
            });
        };
        var getAngleFromCorner = function (corner, width, height) {
            var centerX = width / 2;
            var centerY = height / 2;
            var x = getAbsoluteValue(corner[0], width) - centerX;
            var y = centerY - getAbsoluteValue(corner[1], height);
            return (Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2);
        };
        var calculateGradientDirection = function (angle, width, height) {
            var radian = typeof angle === 'number' ? angle : getAngleFromCorner(angle, width, height);
            var lineLength = Math.abs(width * Math.sin(radian)) + Math.abs(height * Math.cos(radian));
            var halfWidth = width / 2;
            var halfHeight = height / 2;
            var halfLineLength = lineLength / 2;
            var yDiff = Math.sin(radian - Math.PI / 2) * halfLineLength;
            var xDiff = Math.cos(radian - Math.PI / 2) * halfLineLength;
            return [lineLength, halfWidth - xDiff, halfWidth + xDiff, halfHeight - yDiff, halfHeight + yDiff];
        };
        var distance = function (a, b) { return Math.sqrt(a * a + b * b); };
        var findCorner = function (width, height, x, y, closest) {
            var corners = [
                [0, 0],
                [0, height],
                [width, 0],
                [width, height]
            ];
            return corners.reduce(function (stat, corner) {
                var cx = corner[0], cy = corner[1];
                var d = distance(x - cx, y - cy);
                if (closest ? d < stat.optimumDistance : d > stat.optimumDistance) {
                    return {
                        optimumCorner: corner,
                        optimumDistance: d
                    };
                }
                return stat;
            }, {
                optimumDistance: closest ? Infinity : -Infinity,
                optimumCorner: null
            }).optimumCorner;
        };
        var calculateRadius = function (gradient, x, y, width, height) {
            var rx = 0;
            var ry = 0;
            switch (gradient.size) {
                case CSSRadialExtent.CLOSEST_SIDE:
                    // The ending shape is sized so that that it exactly meets the side of the gradient box closest to the gradient’s center.
                    // If the shape is an ellipse, it exactly meets the closest side in each dimension.
                    if (gradient.shape === CSSRadialShape.CIRCLE) {
                        rx = ry = Math.min(Math.abs(x), Math.abs(x - width), Math.abs(y), Math.abs(y - height));
                    }
                    else if (gradient.shape === CSSRadialShape.ELLIPSE) {
                        rx = Math.min(Math.abs(x), Math.abs(x - width));
                        ry = Math.min(Math.abs(y), Math.abs(y - height));
                    }
                    break;
                case CSSRadialExtent.CLOSEST_CORNER:
                    // The ending shape is sized so that that it passes through the corner of the gradient box closest to the gradient’s center.
                    // If the shape is an ellipse, the ending shape is given the same aspect-ratio it would have if closest-side were specified.
                    if (gradient.shape === CSSRadialShape.CIRCLE) {
                        rx = ry = Math.min(distance(x, y), distance(x, y - height), distance(x - width, y), distance(x - width, y - height));
                    }
                    else if (gradient.shape === CSSRadialShape.ELLIPSE) {
                        // Compute the ratio ry/rx (which is to be the same as for "closest-side")
                        var c = Math.min(Math.abs(y), Math.abs(y - height)) / Math.min(Math.abs(x), Math.abs(x - width));
                        var _a = findCorner(width, height, x, y, true), cx = _a[0], cy = _a[1];
                        rx = distance(cx - x, (cy - y) / c);
                        ry = c * rx;
                    }
                    break;
                case CSSRadialExtent.FARTHEST_SIDE:
                    // Same as closest-side, except the ending shape is sized based on the farthest side(s)
                    if (gradient.shape === CSSRadialShape.CIRCLE) {
                        rx = ry = Math.max(Math.abs(x), Math.abs(x - width), Math.abs(y), Math.abs(y - height));
                    }
                    else if (gradient.shape === CSSRadialShape.ELLIPSE) {
                        rx = Math.max(Math.abs(x), Math.abs(x - width));
                        ry = Math.max(Math.abs(y), Math.abs(y - height));
                    }
                    break;
                case CSSRadialExtent.FARTHEST_CORNER:
                    // Same as closest-corner, except the ending shape is sized based on the farthest corner.
                    // If the shape is an ellipse, the ending shape is given the same aspect ratio it would have if farthest-side were specified.
                    if (gradient.shape === CSSRadialShape.CIRCLE) {
                        rx = ry = Math.max(distance(x, y), distance(x, y - height), distance(x - width, y), distance(x - width, y - height));
                    }
                    else if (gradient.shape === CSSRadialShape.ELLIPSE) {
                        // Compute the ratio ry/rx (which is to be the same as for "farthest-side")
                        var c = Math.max(Math.abs(y), Math.abs(y - height)) / Math.max(Math.abs(x), Math.abs(x - width));
                        var _b = findCorner(width, height, x, y, false), cx = _b[0], cy = _b[1];
                        rx = distance(cx - x, (cy - y) / c);
                        ry = c * rx;
                    }
                    break;
            }
            if (Array.isArray(gradient.size)) {
                rx = getAbsoluteValue(gradient.size[0], width);
                ry = gradient.size.length === 2 ? getAbsoluteValue(gradient.size[1], height) : rx;
            }
            return [rx, ry];
        };

        var linearGradient = function (tokens) {
            var angle$1 = deg(180);
            var stops = [];
            parseFunctionArgs(tokens).forEach(function (arg, i) {
                if (i === 0) {
                    var firstToken = arg[0];
                    if (firstToken.type === TokenType.IDENT_TOKEN && firstToken.value === 'to') {
                        angle$1 = parseNamedSide(arg);
                        return;
                    }
                    else if (isAngle(firstToken)) {
                        angle$1 = angle.parse(firstToken);
                        return;
                    }
                }
                var colorStop = parseColorStop(arg);
                stops.push(colorStop);
            });
            return { angle: angle$1, stops: stops, type: CSSImageType.LINEAR_GRADIENT };
        };

        var prefixLinearGradient = function (tokens) {
            var angle$1 = deg(180);
            var stops = [];
            parseFunctionArgs(tokens).forEach(function (arg, i) {
                if (i === 0) {
                    var firstToken = arg[0];
                    if (firstToken.type === TokenType.IDENT_TOKEN &&
                        ['top', 'left', 'right', 'bottom'].indexOf(firstToken.value) !== -1) {
                        angle$1 = parseNamedSide(arg);
                        return;
                    }
                    else if (isAngle(firstToken)) {
                        angle$1 = (angle.parse(firstToken) + deg(270)) % deg(360);
                        return;
                    }
                }
                var colorStop = parseColorStop(arg);
                stops.push(colorStop);
            });
            return {
                angle: angle$1,
                stops: stops,
                type: CSSImageType.LINEAR_GRADIENT
            };
        };

        var testRangeBounds = function (document) {
            var TEST_HEIGHT = 123;
            if (document.createRange) {
                var range = document.createRange();
                if (range.getBoundingClientRect) {
                    var testElement = document.createElement('boundtest');
                    testElement.style.height = TEST_HEIGHT + "px";
                    testElement.style.display = 'block';
                    document.body.appendChild(testElement);
                    range.selectNode(testElement);
                    var rangeBounds = range.getBoundingClientRect();
                    var rangeHeight = Math.round(rangeBounds.height);
                    document.body.removeChild(testElement);
                    if (rangeHeight === TEST_HEIGHT) {
                        return true;
                    }
                }
            }
            return false;
        };
        var testCORS = function () { return typeof new Image().crossOrigin !== 'undefined'; };
        var testResponseType = function () { return typeof new XMLHttpRequest().responseType === 'string'; };
        var testSVG = function (document) {
            var img = new Image();
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            if (!ctx) {
                return false;
            }
            img.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'></svg>";
            try {
                ctx.drawImage(img, 0, 0);
                canvas.toDataURL();
            }
            catch (e) {
                return false;
            }
            return true;
        };
        var isGreenPixel = function (data) {
            return data[0] === 0 && data[1] === 255 && data[2] === 0 && data[3] === 255;
        };
        var testForeignObject = function (document) {
            var canvas = document.createElement('canvas');
            var size = 100;
            canvas.width = size;
            canvas.height = size;
            var ctx = canvas.getContext('2d');
            if (!ctx) {
                return Promise.reject(false);
            }
            ctx.fillStyle = 'rgb(0, 255, 0)';
            ctx.fillRect(0, 0, size, size);
            var img = new Image();
            var greenImageSrc = canvas.toDataURL();
            img.src = greenImageSrc;
            var svg = createForeignObjectSVG(size, size, 0, 0, img);
            ctx.fillStyle = 'red';
            ctx.fillRect(0, 0, size, size);
            return loadSerializedSVG$1(svg)
                .then(function (img) {
                ctx.drawImage(img, 0, 0);
                var data = ctx.getImageData(0, 0, size, size).data;
                ctx.fillStyle = 'red';
                ctx.fillRect(0, 0, size, size);
                var node = document.createElement('div');
                node.style.backgroundImage = "url(" + greenImageSrc + ")";
                node.style.height = size + "px";
                // Firefox 55 does not render inline <img /> tags
                return isGreenPixel(data)
                    ? loadSerializedSVG$1(createForeignObjectSVG(size, size, 0, 0, node))
                    : Promise.reject(false);
            })
                .then(function (img) {
                ctx.drawImage(img, 0, 0);
                // Edge does not render background-images
                return isGreenPixel(ctx.getImageData(0, 0, size, size).data);
            })
                .catch(function () { return false; });
        };
        var createForeignObjectSVG = function (width, height, x, y, node) {
            var xmlns = 'http://www.w3.org/2000/svg';
            var svg = document.createElementNS(xmlns, 'svg');
            var foreignObject = document.createElementNS(xmlns, 'foreignObject');
            svg.setAttributeNS(null, 'width', width.toString());
            svg.setAttributeNS(null, 'height', height.toString());
            foreignObject.setAttributeNS(null, 'width', '100%');
            foreignObject.setAttributeNS(null, 'height', '100%');
            foreignObject.setAttributeNS(null, 'x', x.toString());
            foreignObject.setAttributeNS(null, 'y', y.toString());
            foreignObject.setAttributeNS(null, 'externalResourcesRequired', 'true');
            svg.appendChild(foreignObject);
            foreignObject.appendChild(node);
            return svg;
        };
        var loadSerializedSVG$1 = function (svg) {
            return new Promise(function (resolve, reject) {
                var img = new Image();
                img.onload = function () { return resolve(img); };
                img.onerror = reject;
                img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
            });
        };
        var FEATURES = {
            get SUPPORT_RANGE_BOUNDS() {
                var value = testRangeBounds(document);
                Object.defineProperty(FEATURES, 'SUPPORT_RANGE_BOUNDS', { value: value });
                return value;
            },
            get SUPPORT_SVG_DRAWING() {
                var value = testSVG(document);
                Object.defineProperty(FEATURES, 'SUPPORT_SVG_DRAWING', { value: value });
                return value;
            },
            get SUPPORT_FOREIGNOBJECT_DRAWING() {
                var value = typeof Array.from === 'function' && typeof window.fetch === 'function'
                    ? testForeignObject(document)
                    : Promise.resolve(false);
                Object.defineProperty(FEATURES, 'SUPPORT_FOREIGNOBJECT_DRAWING', { value: value });
                return value;
            },
            get SUPPORT_CORS_IMAGES() {
                var value = testCORS();
                Object.defineProperty(FEATURES, 'SUPPORT_CORS_IMAGES', { value: value });
                return value;
            },
            get SUPPORT_RESPONSE_TYPE() {
                var value = testResponseType();
                Object.defineProperty(FEATURES, 'SUPPORT_RESPONSE_TYPE', { value: value });
                return value;
            },
            get SUPPORT_CORS_XHR() {
                var value = 'withCredentials' in new XMLHttpRequest();
                Object.defineProperty(FEATURES, 'SUPPORT_CORS_XHR', { value: value });
                return value;
            }
        };

        var Logger = /** @class */ (function () {
            function Logger(_a) {
                var id = _a.id, enabled = _a.enabled;
                this.id = id;
                this.enabled = enabled;
                this.start = Date.now();
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Logger.prototype.debug = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                if (this.enabled) {
                    // eslint-disable-next-line no-console
                    if (typeof window !== 'undefined' && window.console && typeof console.debug === 'function') {
                        // eslint-disable-next-line no-console
                        console.debug.apply(console, __spreadArray([this.id, this.getTime() + "ms"], args));
                    }
                    else {
                        this.info.apply(this, args);
                    }
                }
            };
            Logger.prototype.getTime = function () {
                return Date.now() - this.start;
            };
            Logger.create = function (options) {
                Logger.instances[options.id] = new Logger(options);
            };
            Logger.destroy = function (id) {
                delete Logger.instances[id];
            };
            Logger.getInstance = function (id) {
                var instance = Logger.instances[id];
                if (typeof instance === 'undefined') {
                    throw new Error("No logger instance found with id " + id);
                }
                return instance;
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Logger.prototype.info = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                if (this.enabled) {
                    // eslint-disable-next-line no-console
                    if (typeof window !== 'undefined' && window.console && typeof console.info === 'function') {
                        // eslint-disable-next-line no-console
                        console.info.apply(console, __spreadArray([this.id, this.getTime() + "ms"], args));
                    }
                }
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Logger.prototype.error = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                if (this.enabled) {
                    // eslint-disable-next-line no-console
                    if (typeof window !== 'undefined' && window.console && typeof console.error === 'function') {
                        // eslint-disable-next-line no-console
                        console.error.apply(console, __spreadArray([this.id, this.getTime() + "ms"], args));
                    }
                    else {
                        this.info.apply(this, args);
                    }
                }
            };
            Logger.instances = {};
            return Logger;
        }());

        var CacheStorage = /** @class */ (function () {
            function CacheStorage() {
            }
            CacheStorage.create = function (name, options) {
                return (CacheStorage._caches[name] = new Cache(name, options));
            };
            CacheStorage.destroy = function (name) {
                delete CacheStorage._caches[name];
            };
            CacheStorage.open = function (name) {
                var cache = CacheStorage._caches[name];
                if (typeof cache !== 'undefined') {
                    return cache;
                }
                throw new Error("Cache with key \"" + name + "\" not found");
            };
            CacheStorage.getOrigin = function (url) {
                var link = CacheStorage._link;
                if (!link) {
                    return 'about:blank';
                }
                link.href = url;
                link.href = link.href; // IE9, LOL! - http://jsfiddle.net/niklasvh/2e48b/
                return link.protocol + link.hostname + link.port;
            };
            CacheStorage.isSameOrigin = function (src) {
                return CacheStorage.getOrigin(src) === CacheStorage._origin;
            };
            CacheStorage.setContext = function (window) {
                CacheStorage._link = window.document.createElement('a');
                CacheStorage._origin = CacheStorage.getOrigin(window.location.href);
            };
            CacheStorage.getInstance = function () {
                var current = CacheStorage._current;
                if (current === null) {
                    throw new Error("No cache instance attached");
                }
                return current;
            };
            CacheStorage.attachInstance = function (cache) {
                CacheStorage._current = cache;
            };
            CacheStorage.detachInstance = function () {
                CacheStorage._current = null;
            };
            CacheStorage._caches = {};
            CacheStorage._origin = 'about:blank';
            CacheStorage._current = null;
            return CacheStorage;
        }());
        var Cache = /** @class */ (function () {
            function Cache(id, options) {
                this.id = id;
                this._options = options;
                this._cache = {};
            }
            Cache.prototype.addImage = function (src) {
                var result = Promise.resolve();
                if (this.has(src)) {
                    return result;
                }
                if (isBlobImage(src) || isRenderable(src)) {
                    (this._cache[src] = this.loadImage(src)).catch(function () {
                        // prevent unhandled rejection
                    });
                    return result;
                }
                return result;
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Cache.prototype.match = function (src) {
                return this._cache[src];
            };
            Cache.prototype.loadImage = function (key) {
                return __awaiter(this, void 0, void 0, function () {
                    var isSameOrigin, useCORS, useProxy, src;
                    var _this = this;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                isSameOrigin = CacheStorage.isSameOrigin(key);
                                useCORS = !isInlineImage(key) && this._options.useCORS === true && FEATURES.SUPPORT_CORS_IMAGES && !isSameOrigin;
                                useProxy = !isInlineImage(key) &&
                                    !isSameOrigin &&
                                    !isBlobImage(key) &&
                                    typeof this._options.proxy === 'string' &&
                                    FEATURES.SUPPORT_CORS_XHR &&
                                    !useCORS;
                                if (!isSameOrigin &&
                                    this._options.allowTaint === false &&
                                    !isInlineImage(key) &&
                                    !isBlobImage(key) &&
                                    !useProxy &&
                                    !useCORS) {
                                    return [2 /*return*/];
                                }
                                src = key;
                                if (!useProxy) return [3 /*break*/, 2];
                                return [4 /*yield*/, this.proxy(src)];
                            case 1:
                                src = _a.sent();
                                _a.label = 2;
                            case 2:
                                Logger.getInstance(this.id).debug("Added image " + key.substring(0, 256));
                                return [4 /*yield*/, new Promise(function (resolve, reject) {
                                        var img = new Image();
                                        img.onload = function () { return resolve(img); };
                                        img.onerror = reject;
                                        //ios safari 10.3 taints canvas with data urls unless crossOrigin is set to anonymous
                                        if (isInlineBase64Image(src) || useCORS) {
                                            img.crossOrigin = 'anonymous';
                                        }
                                        img.src = src;
                                        if (img.complete === true) {
                                            // Inline XML images may fail to parse, throwing an Error later on
                                            setTimeout(function () { return resolve(img); }, 500);
                                        }
                                        if (_this._options.imageTimeout > 0) {
                                            setTimeout(function () { return reject("Timed out (" + _this._options.imageTimeout + "ms) loading image"); }, _this._options.imageTimeout);
                                        }
                                    })];
                            case 3: return [2 /*return*/, _a.sent()];
                        }
                    });
                });
            };
            Cache.prototype.has = function (key) {
                return typeof this._cache[key] !== 'undefined';
            };
            Cache.prototype.keys = function () {
                return Promise.resolve(Object.keys(this._cache));
            };
            Cache.prototype.proxy = function (src) {
                var _this = this;
                var proxy = this._options.proxy;
                if (!proxy) {
                    throw new Error('No proxy defined');
                }
                var key = src.substring(0, 256);
                return new Promise(function (resolve, reject) {
                    var responseType = FEATURES.SUPPORT_RESPONSE_TYPE ? 'blob' : 'text';
                    var xhr = new XMLHttpRequest();
                    xhr.onload = function () {
                        if (xhr.status === 200) {
                            if (responseType === 'text') {
                                resolve(xhr.response);
                            }
                            else {
                                var reader_1 = new FileReader();
                                reader_1.addEventListener('load', function () { return resolve(reader_1.result); }, false);
                                reader_1.addEventListener('error', function (e) { return reject(e); }, false);
                                reader_1.readAsDataURL(xhr.response);
                            }
                        }
                        else {
                            reject("Failed to proxy resource " + key + " with status code " + xhr.status);
                        }
                    };
                    xhr.onerror = reject;
                    var queryString = proxy.indexOf('?') > -1 ? '&' : '?';
                    xhr.open('GET', "" + proxy + queryString + "url=" + encodeURIComponent(src) + "&responseType=" + responseType);
                    if (responseType !== 'text' && xhr instanceof XMLHttpRequest) {
                        xhr.responseType = responseType;
                    }
                    if (_this._options.imageTimeout) {
                        var timeout_1 = _this._options.imageTimeout;
                        xhr.timeout = timeout_1;
                        xhr.ontimeout = function () { return reject("Timed out (" + timeout_1 + "ms) proxying " + key); };
                    }
                    xhr.send();
                });
            };
            return Cache;
        }());
        var INLINE_SVG = /^data:image\/svg\+xml/i;
        var INLINE_BASE64 = /^data:image\/.*;base64,/i;
        var INLINE_IMG = /^data:image\/.*/i;
        var isRenderable = function (src) { return FEATURES.SUPPORT_SVG_DRAWING || !isSVG(src); };
        var isInlineImage = function (src) { return INLINE_IMG.test(src); };
        var isInlineBase64Image = function (src) { return INLINE_BASE64.test(src); };
        var isBlobImage = function (src) { return src.substr(0, 4) === 'blob'; };
        var isSVG = function (src) { return src.substr(-3).toLowerCase() === 'svg' || INLINE_SVG.test(src); };

        var webkitGradient = function (tokens) {
            var angle = deg(180);
            var stops = [];
            var type = CSSImageType.LINEAR_GRADIENT;
            var shape = CSSRadialShape.CIRCLE;
            var size = CSSRadialExtent.FARTHEST_CORNER;
            var position = [];
            parseFunctionArgs(tokens).forEach(function (arg, i) {
                var firstToken = arg[0];
                if (i === 0) {
                    if (isIdentToken(firstToken) && firstToken.value === 'linear') {
                        type = CSSImageType.LINEAR_GRADIENT;
                        return;
                    }
                    else if (isIdentToken(firstToken) && firstToken.value === 'radial') {
                        type = CSSImageType.RADIAL_GRADIENT;
                        return;
                    }
                }
                if (firstToken.type === TokenType.FUNCTION) {
                    if (firstToken.name === 'from') {
                        var color = color$1.parse(firstToken.values[0]);
                        stops.push({ stop: ZERO_LENGTH, color: color });
                    }
                    else if (firstToken.name === 'to') {
                        var color = color$1.parse(firstToken.values[0]);
                        stops.push({ stop: HUNDRED_PERCENT, color: color });
                    }
                    else if (firstToken.name === 'color-stop') {
                        var values = firstToken.values.filter(nonFunctionArgSeparator);
                        if (values.length === 2) {
                            var color = color$1.parse(values[1]);
                            var stop_1 = values[0];
                            if (isNumberToken(stop_1)) {
                                stops.push({
                                    stop: { type: TokenType.PERCENTAGE_TOKEN, number: stop_1.number * 100, flags: stop_1.flags },
                                    color: color
                                });
                            }
                        }
                    }
                }
            });
            return type === CSSImageType.LINEAR_GRADIENT
                ? {
                    angle: (angle + deg(180)) % deg(360),
                    stops: stops,
                    type: type
                }
                : { size: size, shape: shape, stops: stops, position: position, type: type };
        };

        var CLOSEST_SIDE = 'closest-side';
        var FARTHEST_SIDE = 'farthest-side';
        var CLOSEST_CORNER = 'closest-corner';
        var FARTHEST_CORNER = 'farthest-corner';
        var CIRCLE = 'circle';
        var ELLIPSE = 'ellipse';
        var COVER = 'cover';
        var CONTAIN = 'contain';
        var radialGradient = function (tokens) {
            var shape = CSSRadialShape.CIRCLE;
            var size = CSSRadialExtent.FARTHEST_CORNER;
            var stops = [];
            var position = [];
            parseFunctionArgs(tokens).forEach(function (arg, i) {
                var isColorStop = true;
                if (i === 0) {
                    var isAtPosition_1 = false;
                    isColorStop = arg.reduce(function (acc, token) {
                        if (isAtPosition_1) {
                            if (isIdentToken(token)) {
                                switch (token.value) {
                                    case 'center':
                                        position.push(FIFTY_PERCENT);
                                        return acc;
                                    case 'top':
                                    case 'left':
                                        position.push(ZERO_LENGTH);
                                        return acc;
                                    case 'right':
                                    case 'bottom':
                                        position.push(HUNDRED_PERCENT);
                                        return acc;
                                }
                            }
                            else if (isLengthPercentage(token) || isLength(token)) {
                                position.push(token);
                            }
                        }
                        else if (isIdentToken(token)) {
                            switch (token.value) {
                                case CIRCLE:
                                    shape = CSSRadialShape.CIRCLE;
                                    return false;
                                case ELLIPSE:
                                    shape = CSSRadialShape.ELLIPSE;
                                    return false;
                                case 'at':
                                    isAtPosition_1 = true;
                                    return false;
                                case CLOSEST_SIDE:
                                    size = CSSRadialExtent.CLOSEST_SIDE;
                                    return false;
                                case COVER:
                                case FARTHEST_SIDE:
                                    size = CSSRadialExtent.FARTHEST_SIDE;
                                    return false;
                                case CONTAIN:
                                case CLOSEST_CORNER:
                                    size = CSSRadialExtent.CLOSEST_CORNER;
                                    return false;
                                case FARTHEST_CORNER:
                                    size = CSSRadialExtent.FARTHEST_CORNER;
                                    return false;
                            }
                        }
                        else if (isLength(token) || isLengthPercentage(token)) {
                            if (!Array.isArray(size)) {
                                size = [];
                            }
                            size.push(token);
                            return false;
                        }
                        return acc;
                    }, isColorStop);
                }
                if (isColorStop) {
                    var colorStop = parseColorStop(arg);
                    stops.push(colorStop);
                }
            });
            return { size: size, shape: shape, stops: stops, position: position, type: CSSImageType.RADIAL_GRADIENT };
        };

        var prefixRadialGradient = function (tokens) {
            var shape = CSSRadialShape.CIRCLE;
            var size = CSSRadialExtent.FARTHEST_CORNER;
            var stops = [];
            var position = [];
            parseFunctionArgs(tokens).forEach(function (arg, i) {
                var isColorStop = true;
                if (i === 0) {
                    isColorStop = arg.reduce(function (acc, token) {
                        if (isIdentToken(token)) {
                            switch (token.value) {
                                case 'center':
                                    position.push(FIFTY_PERCENT);
                                    return false;
                                case 'top':
                                case 'left':
                                    position.push(ZERO_LENGTH);
                                    return false;
                                case 'right':
                                case 'bottom':
                                    position.push(HUNDRED_PERCENT);
                                    return false;
                            }
                        }
                        else if (isLengthPercentage(token) || isLength(token)) {
                            position.push(token);
                            return false;
                        }
                        return acc;
                    }, isColorStop);
                }
                else if (i === 1) {
                    isColorStop = arg.reduce(function (acc, token) {
                        if (isIdentToken(token)) {
                            switch (token.value) {
                                case CIRCLE:
                                    shape = CSSRadialShape.CIRCLE;
                                    return false;
                                case ELLIPSE:
                                    shape = CSSRadialShape.ELLIPSE;
                                    return false;
                                case CONTAIN:
                                case CLOSEST_SIDE:
                                    size = CSSRadialExtent.CLOSEST_SIDE;
                                    return false;
                                case FARTHEST_SIDE:
                                    size = CSSRadialExtent.FARTHEST_SIDE;
                                    return false;
                                case CLOSEST_CORNER:
                                    size = CSSRadialExtent.CLOSEST_CORNER;
                                    return false;
                                case COVER:
                                case FARTHEST_CORNER:
                                    size = CSSRadialExtent.FARTHEST_CORNER;
                                    return false;
                            }
                        }
                        else if (isLength(token) || isLengthPercentage(token)) {
                            if (!Array.isArray(size)) {
                                size = [];
                            }
                            size.push(token);
                            return false;
                        }
                        return acc;
                    }, isColorStop);
                }
                if (isColorStop) {
                    var colorStop = parseColorStop(arg);
                    stops.push(colorStop);
                }
            });
            return { size: size, shape: shape, stops: stops, position: position, type: CSSImageType.RADIAL_GRADIENT };
        };

        var CSSImageType;
        (function (CSSImageType) {
            CSSImageType[CSSImageType["URL"] = 0] = "URL";
            CSSImageType[CSSImageType["LINEAR_GRADIENT"] = 1] = "LINEAR_GRADIENT";
            CSSImageType[CSSImageType["RADIAL_GRADIENT"] = 2] = "RADIAL_GRADIENT";
        })(CSSImageType || (CSSImageType = {}));
        var isLinearGradient = function (background) {
            return background.type === CSSImageType.LINEAR_GRADIENT;
        };
        var isRadialGradient = function (background) {
            return background.type === CSSImageType.RADIAL_GRADIENT;
        };
        var CSSRadialShape;
        (function (CSSRadialShape) {
            CSSRadialShape[CSSRadialShape["CIRCLE"] = 0] = "CIRCLE";
            CSSRadialShape[CSSRadialShape["ELLIPSE"] = 1] = "ELLIPSE";
        })(CSSRadialShape || (CSSRadialShape = {}));
        var CSSRadialExtent;
        (function (CSSRadialExtent) {
            CSSRadialExtent[CSSRadialExtent["CLOSEST_SIDE"] = 0] = "CLOSEST_SIDE";
            CSSRadialExtent[CSSRadialExtent["FARTHEST_SIDE"] = 1] = "FARTHEST_SIDE";
            CSSRadialExtent[CSSRadialExtent["CLOSEST_CORNER"] = 2] = "CLOSEST_CORNER";
            CSSRadialExtent[CSSRadialExtent["FARTHEST_CORNER"] = 3] = "FARTHEST_CORNER";
        })(CSSRadialExtent || (CSSRadialExtent = {}));
        var image = {
            name: 'image',
            parse: function (value) {
                if (value.type === TokenType.URL_TOKEN) {
                    var image_1 = { url: value.value, type: CSSImageType.URL };
                    CacheStorage.getInstance().addImage(value.value);
                    return image_1;
                }
                if (value.type === TokenType.FUNCTION) {
                    var imageFunction = SUPPORTED_IMAGE_FUNCTIONS[value.name];
                    if (typeof imageFunction === 'undefined') {
                        throw new Error("Attempting to parse an unsupported image function \"" + value.name + "\"");
                    }
                    return imageFunction(value.values);
                }
                throw new Error("Unsupported image type");
            }
        };
        function isSupportedImage(value) {
            return value.type !== TokenType.FUNCTION || !!SUPPORTED_IMAGE_FUNCTIONS[value.name];
        }
        var SUPPORTED_IMAGE_FUNCTIONS = {
            'linear-gradient': linearGradient,
            '-moz-linear-gradient': prefixLinearGradient,
            '-ms-linear-gradient': prefixLinearGradient,
            '-o-linear-gradient': prefixLinearGradient,
            '-webkit-linear-gradient': prefixLinearGradient,
            'radial-gradient': radialGradient,
            '-moz-radial-gradient': prefixRadialGradient,
            '-ms-radial-gradient': prefixRadialGradient,
            '-o-radial-gradient': prefixRadialGradient,
            '-webkit-radial-gradient': prefixRadialGradient,
            '-webkit-gradient': webkitGradient
        };

        var backgroundImage = {
            name: 'background-image',
            initialValue: 'none',
            type: PropertyDescriptorParsingType.LIST,
            prefix: false,
            parse: function (tokens) {
                if (tokens.length === 0) {
                    return [];
                }
                var first = tokens[0];
                if (first.type === TokenType.IDENT_TOKEN && first.value === 'none') {
                    return [];
                }
                return tokens.filter(function (value) { return nonFunctionArgSeparator(value) && isSupportedImage(value); }).map(image.parse);
            }
        };

        var backgroundOrigin = {
            name: 'background-origin',
            initialValue: 'border-box',
            prefix: false,
            type: PropertyDescriptorParsingType.LIST,
            parse: function (tokens) {
                return tokens.map(function (token) {
                    if (isIdentToken(token)) {
                        switch (token.value) {
                            case 'padding-box':
                                return 1 /* PADDING_BOX */;
                            case 'content-box':
                                return 2 /* CONTENT_BOX */;
                        }
                    }
                    return 0 /* BORDER_BOX */;
                });
            }
        };

        var backgroundPosition = {
            name: 'background-position',
            initialValue: '0% 0%',
            type: PropertyDescriptorParsingType.LIST,
            prefix: false,
            parse: function (tokens) {
                return parseFunctionArgs(tokens)
                    .map(function (values) { return values.filter(isLengthPercentage); })
                    .map(parseLengthPercentageTuple);
            }
        };

        var BACKGROUND_REPEAT;
        (function (BACKGROUND_REPEAT) {
            BACKGROUND_REPEAT[BACKGROUND_REPEAT["REPEAT"] = 0] = "REPEAT";
            BACKGROUND_REPEAT[BACKGROUND_REPEAT["NO_REPEAT"] = 1] = "NO_REPEAT";
            BACKGROUND_REPEAT[BACKGROUND_REPEAT["REPEAT_X"] = 2] = "REPEAT_X";
            BACKGROUND_REPEAT[BACKGROUND_REPEAT["REPEAT_Y"] = 3] = "REPEAT_Y";
        })(BACKGROUND_REPEAT || (BACKGROUND_REPEAT = {}));
        var backgroundRepeat = {
            name: 'background-repeat',
            initialValue: 'repeat',
            prefix: false,
            type: PropertyDescriptorParsingType.LIST,
            parse: function (tokens) {
                return parseFunctionArgs(tokens)
                    .map(function (values) {
                    return values
                        .filter(isIdentToken)
                        .map(function (token) { return token.value; })
                        .join(' ');
                })
                    .map(parseBackgroundRepeat);
            }
        };
        var parseBackgroundRepeat = function (value) {
            switch (value) {
                case 'no-repeat':
                    return BACKGROUND_REPEAT.NO_REPEAT;
                case 'repeat-x':
                case 'repeat no-repeat':
                    return BACKGROUND_REPEAT.REPEAT_X;
                case 'repeat-y':
                case 'no-repeat repeat':
                    return BACKGROUND_REPEAT.REPEAT_Y;
                case 'repeat':
                default:
                    return BACKGROUND_REPEAT.REPEAT;
            }
        };

        var BACKGROUND_SIZE;
        (function (BACKGROUND_SIZE) {
            BACKGROUND_SIZE["AUTO"] = "auto";
            BACKGROUND_SIZE["CONTAIN"] = "contain";
            BACKGROUND_SIZE["COVER"] = "cover";
        })(BACKGROUND_SIZE || (BACKGROUND_SIZE = {}));
        var backgroundSize = {
            name: 'background-size',
            initialValue: '0',
            prefix: false,
            type: PropertyDescriptorParsingType.LIST,
            parse: function (tokens) {
                return parseFunctionArgs(tokens).map(function (values) { return values.filter(isBackgroundSizeInfoToken); });
            }
        };
        var isBackgroundSizeInfoToken = function (value) {
            return isIdentToken(value) || isLengthPercentage(value);
        };

        var borderColorForSide = function (side) { return ({
            name: "border-" + side + "-color",
            initialValue: 'transparent',
            prefix: false,
            type: PropertyDescriptorParsingType.TYPE_VALUE,
            format: 'color'
        }); };
        var borderTopColor = borderColorForSide('top');
        var borderRightColor = borderColorForSide('right');
        var borderBottomColor = borderColorForSide('bottom');
        var borderLeftColor = borderColorForSide('left');

        var borderRadiusForSide = function (side) { return ({
            name: "border-radius-" + side,
            initialValue: '0 0',
            prefix: false,
            type: PropertyDescriptorParsingType.LIST,
            parse: function (tokens) { return parseLengthPercentageTuple(tokens.filter(isLengthPercentage)); }
        }); };
        var borderTopLeftRadius = borderRadiusForSide('top-left');
        var borderTopRightRadius = borderRadiusForSide('top-right');
        var borderBottomRightRadius = borderRadiusForSide('bottom-right');
        var borderBottomLeftRadius = borderRadiusForSide('bottom-left');

        var BORDER_STYLE;
        (function (BORDER_STYLE) {
            BORDER_STYLE[BORDER_STYLE["NONE"] = 0] = "NONE";
            BORDER_STYLE[BORDER_STYLE["SOLID"] = 1] = "SOLID";
            BORDER_STYLE[BORDER_STYLE["DASHED"] = 2] = "DASHED";
            BORDER_STYLE[BORDER_STYLE["DOTTED"] = 3] = "DOTTED";
            BORDER_STYLE[BORDER_STYLE["DOUBLE"] = 4] = "DOUBLE";
        })(BORDER_STYLE || (BORDER_STYLE = {}));
        var borderStyleForSide = function (side) { return ({
            name: "border-" + side + "-style",
            initialValue: 'solid',
            prefix: false,
            type: PropertyDescriptorParsingType.IDENT_VALUE,
            parse: function (style) {
                switch (style) {
                    case 'none':
                        return BORDER_STYLE.NONE;
                    case 'dashed':
                        return BORDER_STYLE.DASHED;
                    case 'dotted':
                        return BORDER_STYLE.DOTTED;
                    case 'double':
                        return BORDER_STYLE.DOUBLE;
                }
                return BORDER_STYLE.SOLID;
            }
        }); };
        var borderTopStyle = borderStyleForSide('top');
        var borderRightStyle = borderStyleForSide('right');
        var borderBottomStyle = borderStyleForSide('bottom');
        var borderLeftStyle = borderStyleForSide('left');

        var borderWidthForSide = function (side) { return ({
            name: "border-" + side + "-width",
            initialValue: '0',
            type: PropertyDescriptorParsingType.VALUE,
            prefix: false,
            parse: function (token) {
                if (isDimensionToken(token)) {
                    return token.number;
                }
                return 0;
            }
        }); };
        var borderTopWidth = borderWidthForSide('top');
        var borderRightWidth = borderWidthForSide('right');
        var borderBottomWidth = borderWidthForSide('bottom');
        var borderLeftWidth = borderWidthForSide('left');

        var color = {
            name: "color",
            initialValue: 'transparent',
            prefix: false,
            type: PropertyDescriptorParsingType.TYPE_VALUE,
            format: 'color'
        };

        var display = {
            name: 'display',
            initialValue: 'inline-block',
            prefix: false,
            type: PropertyDescriptorParsingType.LIST,
            parse: function (tokens) {
                return tokens.filter(isIdentToken).reduce(function (bit, token) {
                    return bit | parseDisplayValue(token.value);
                }, 0 /* NONE */);
            }
        };
        var parseDisplayValue = function (display) {
            switch (display) {
                case 'block':
                case '-webkit-box':
                    return 2 /* BLOCK */;
                case 'inline':
                    return 4 /* INLINE */;
                case 'run-in':
                    return 8 /* RUN_IN */;
                case 'flow':
                    return 16 /* FLOW */;
                case 'flow-root':
                    return 32 /* FLOW_ROOT */;
                case 'table':
                    return 64 /* TABLE */;
                case 'flex':
                case '-webkit-flex':
                    return 128 /* FLEX */;
                case 'grid':
                case '-ms-grid':
                    return 256 /* GRID */;
                case 'ruby':
                    return 512 /* RUBY */;
                case 'subgrid':
                    return 1024 /* SUBGRID */;
                case 'list-item':
                    return 2048 /* LIST_ITEM */;
                case 'table-row-group':
                    return 4096 /* TABLE_ROW_GROUP */;
                case 'table-header-group':
                    return 8192 /* TABLE_HEADER_GROUP */;
                case 'table-footer-group':
                    return 16384 /* TABLE_FOOTER_GROUP */;
                case 'table-row':
                    return 32768 /* TABLE_ROW */;
                case 'table-cell':
                    return 65536 /* TABLE_CELL */;
                case 'table-column-group':
                    return 131072 /* TABLE_COLUMN_GROUP */;
                case 'table-column':
                    return 262144 /* TABLE_COLUMN */;
                case 'table-caption':
                    return 524288 /* TABLE_CAPTION */;
                case 'ruby-base':
                    return 1048576 /* RUBY_BASE */;
                case 'ruby-text':
                    return 2097152 /* RUBY_TEXT */;
                case 'ruby-base-container':
                    return 4194304 /* RUBY_BASE_CONTAINER */;
                case 'ruby-text-container':
                    return 8388608 /* RUBY_TEXT_CONTAINER */;
                case 'contents':
                    return 16777216 /* CONTENTS */;
                case 'inline-block':
                    return 33554432 /* INLINE_BLOCK */;
                case 'inline-list-item':
                    return 67108864 /* INLINE_LIST_ITEM */;
                case 'inline-table':
                    return 134217728 /* INLINE_TABLE */;
                case 'inline-flex':
                    return 268435456 /* INLINE_FLEX */;
                case 'inline-grid':
                    return 536870912 /* INLINE_GRID */;
            }
            return 0 /* NONE */;
        };

        var FLOAT;
        (function (FLOAT) {
            FLOAT[FLOAT["NONE"] = 0] = "NONE";
            FLOAT[FLOAT["LEFT"] = 1] = "LEFT";
            FLOAT[FLOAT["RIGHT"] = 2] = "RIGHT";
            FLOAT[FLOAT["INLINE_START"] = 3] = "INLINE_START";
            FLOAT[FLOAT["INLINE_END"] = 4] = "INLINE_END";
        })(FLOAT || (FLOAT = {}));
        var float = {
            name: 'float',
            initialValue: 'none',
            prefix: false,
            type: PropertyDescriptorParsingType.IDENT_VALUE,
            parse: function (float) {
                switch (float) {
                    case 'left':
                        return FLOAT.LEFT;
                    case 'right':
                        return FLOAT.RIGHT;
                    case 'inline-start':
                        return FLOAT.INLINE_START;
                    case 'inline-end':
                        return FLOAT.INLINE_END;
                }
                return FLOAT.NONE;
            }
        };

        var letterSpacing = {
            name: 'letter-spacing',
            initialValue: '0',
            prefix: false,
            type: PropertyDescriptorParsingType.VALUE,
            parse: function (token) {
                if (token.type === TokenType.IDENT_TOKEN && token.value === 'normal') {
                    return 0;
                }
                if (token.type === TokenType.NUMBER_TOKEN) {
                    return token.number;
                }
                if (token.type === TokenType.DIMENSION_TOKEN) {
                    return token.number;
                }
                return 0;
            }
        };

        var LINE_BREAK;
        (function (LINE_BREAK) {
            LINE_BREAK["NORMAL"] = "normal";
            LINE_BREAK["STRICT"] = "strict";
        })(LINE_BREAK || (LINE_BREAK = {}));
        var lineBreak = {
            name: 'line-break',
            initialValue: 'normal',
            prefix: false,
            type: PropertyDescriptorParsingType.IDENT_VALUE,
            parse: function (lineBreak) {
                switch (lineBreak) {
                    case 'strict':
                        return LINE_BREAK.STRICT;
                    case 'normal':
                    default:
                        return LINE_BREAK.NORMAL;
                }
            }
        };

        var lineHeight = {
            name: 'line-height',
            initialValue: 'normal',
            prefix: false,
            type: PropertyDescriptorParsingType.TOKEN_VALUE
        };
        var computeLineHeight = function (token, fontSize) {
            if (isIdentToken(token) && token.value === 'normal') {
                return 1.2 * fontSize;
            }
            else if (token.type === TokenType.NUMBER_TOKEN) {
                return fontSize * token.number;
            }
            else if (isLengthPercentage(token)) {
                return getAbsoluteValue(token, fontSize);
            }
            return fontSize;
        };

        var listStyleImage = {
            name: 'list-style-image',
            initialValue: 'none',
            type: PropertyDescriptorParsingType.VALUE,
            prefix: false,
            parse: function (token) {
                if (token.type === TokenType.IDENT_TOKEN && token.value === 'none') {
                    return null;
                }
                return image.parse(token);
            }
        };

        var LIST_STYLE_POSITION;
        (function (LIST_STYLE_POSITION) {
            LIST_STYLE_POSITION[LIST_STYLE_POSITION["INSIDE"] = 0] = "INSIDE";
            LIST_STYLE_POSITION[LIST_STYLE_POSITION["OUTSIDE"] = 1] = "OUTSIDE";
        })(LIST_STYLE_POSITION || (LIST_STYLE_POSITION = {}));
        var listStylePosition = {
            name: 'list-style-position',
            initialValue: 'outside',
            prefix: false,
            type: PropertyDescriptorParsingType.IDENT_VALUE,
            parse: function (position) {
                switch (position) {
                    case 'inside':
                        return LIST_STYLE_POSITION.INSIDE;
                    case 'outside':
                    default:
                        return LIST_STYLE_POSITION.OUTSIDE;
                }
            }
        };

        var LIST_STYLE_TYPE;
        (function (LIST_STYLE_TYPE) {
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["NONE"] = -1] = "NONE";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["DISC"] = 0] = "DISC";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["CIRCLE"] = 1] = "CIRCLE";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["SQUARE"] = 2] = "SQUARE";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["DECIMAL"] = 3] = "DECIMAL";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["CJK_DECIMAL"] = 4] = "CJK_DECIMAL";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["DECIMAL_LEADING_ZERO"] = 5] = "DECIMAL_LEADING_ZERO";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["LOWER_ROMAN"] = 6] = "LOWER_ROMAN";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["UPPER_ROMAN"] = 7] = "UPPER_ROMAN";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["LOWER_GREEK"] = 8] = "LOWER_GREEK";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["LOWER_ALPHA"] = 9] = "LOWER_ALPHA";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["UPPER_ALPHA"] = 10] = "UPPER_ALPHA";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["ARABIC_INDIC"] = 11] = "ARABIC_INDIC";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["ARMENIAN"] = 12] = "ARMENIAN";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["BENGALI"] = 13] = "BENGALI";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["CAMBODIAN"] = 14] = "CAMBODIAN";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["CJK_EARTHLY_BRANCH"] = 15] = "CJK_EARTHLY_BRANCH";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["CJK_HEAVENLY_STEM"] = 16] = "CJK_HEAVENLY_STEM";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["CJK_IDEOGRAPHIC"] = 17] = "CJK_IDEOGRAPHIC";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["DEVANAGARI"] = 18] = "DEVANAGARI";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["ETHIOPIC_NUMERIC"] = 19] = "ETHIOPIC_NUMERIC";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["GEORGIAN"] = 20] = "GEORGIAN";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["GUJARATI"] = 21] = "GUJARATI";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["GURMUKHI"] = 22] = "GURMUKHI";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["HEBREW"] = 22] = "HEBREW";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["HIRAGANA"] = 23] = "HIRAGANA";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["HIRAGANA_IROHA"] = 24] = "HIRAGANA_IROHA";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["JAPANESE_FORMAL"] = 25] = "JAPANESE_FORMAL";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["JAPANESE_INFORMAL"] = 26] = "JAPANESE_INFORMAL";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["KANNADA"] = 27] = "KANNADA";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["KATAKANA"] = 28] = "KATAKANA";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["KATAKANA_IROHA"] = 29] = "KATAKANA_IROHA";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["KHMER"] = 30] = "KHMER";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["KOREAN_HANGUL_FORMAL"] = 31] = "KOREAN_HANGUL_FORMAL";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["KOREAN_HANJA_FORMAL"] = 32] = "KOREAN_HANJA_FORMAL";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["KOREAN_HANJA_INFORMAL"] = 33] = "KOREAN_HANJA_INFORMAL";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["LAO"] = 34] = "LAO";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["LOWER_ARMENIAN"] = 35] = "LOWER_ARMENIAN";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["MALAYALAM"] = 36] = "MALAYALAM";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["MONGOLIAN"] = 37] = "MONGOLIAN";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["MYANMAR"] = 38] = "MYANMAR";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["ORIYA"] = 39] = "ORIYA";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["PERSIAN"] = 40] = "PERSIAN";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["SIMP_CHINESE_FORMAL"] = 41] = "SIMP_CHINESE_FORMAL";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["SIMP_CHINESE_INFORMAL"] = 42] = "SIMP_CHINESE_INFORMAL";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["TAMIL"] = 43] = "TAMIL";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["TELUGU"] = 44] = "TELUGU";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["THAI"] = 45] = "THAI";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["TIBETAN"] = 46] = "TIBETAN";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["TRAD_CHINESE_FORMAL"] = 47] = "TRAD_CHINESE_FORMAL";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["TRAD_CHINESE_INFORMAL"] = 48] = "TRAD_CHINESE_INFORMAL";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["UPPER_ARMENIAN"] = 49] = "UPPER_ARMENIAN";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["DISCLOSURE_OPEN"] = 50] = "DISCLOSURE_OPEN";
            LIST_STYLE_TYPE[LIST_STYLE_TYPE["DISCLOSURE_CLOSED"] = 51] = "DISCLOSURE_CLOSED";
        })(LIST_STYLE_TYPE || (LIST_STYLE_TYPE = {}));
        var listStyleType = {
            name: 'list-style-type',
            initialValue: 'none',
            prefix: false,
            type: PropertyDescriptorParsingType.IDENT_VALUE,
            parse: function (type) {
                switch (type) {
                    case 'disc':
                        return LIST_STYLE_TYPE.DISC;
                    case 'circle':
                        return LIST_STYLE_TYPE.CIRCLE;
                    case 'square':
                        return LIST_STYLE_TYPE.SQUARE;
                    case 'decimal':
                        return LIST_STYLE_TYPE.DECIMAL;
                    case 'cjk-decimal':
                        return LIST_STYLE_TYPE.CJK_DECIMAL;
                    case 'decimal-leading-zero':
                        return LIST_STYLE_TYPE.DECIMAL_LEADING_ZERO;
                    case 'lower-roman':
                        return LIST_STYLE_TYPE.LOWER_ROMAN;
                    case 'upper-roman':
                        return LIST_STYLE_TYPE.UPPER_ROMAN;
                    case 'lower-greek':
                        return LIST_STYLE_TYPE.LOWER_GREEK;
                    case 'lower-alpha':
                        return LIST_STYLE_TYPE.LOWER_ALPHA;
                    case 'upper-alpha':
                        return LIST_STYLE_TYPE.UPPER_ALPHA;
                    case 'arabic-indic':
                        return LIST_STYLE_TYPE.ARABIC_INDIC;
                    case 'armenian':
                        return LIST_STYLE_TYPE.ARMENIAN;
                    case 'bengali':
                        return LIST_STYLE_TYPE.BENGALI;
                    case 'cambodian':
                        return LIST_STYLE_TYPE.CAMBODIAN;
                    case 'cjk-earthly-branch':
                        return LIST_STYLE_TYPE.CJK_EARTHLY_BRANCH;
                    case 'cjk-heavenly-stem':
                        return LIST_STYLE_TYPE.CJK_HEAVENLY_STEM;
                    case 'cjk-ideographic':
                        return LIST_STYLE_TYPE.CJK_IDEOGRAPHIC;
                    case 'devanagari':
                        return LIST_STYLE_TYPE.DEVANAGARI;
                    case 'ethiopic-numeric':
                        return LIST_STYLE_TYPE.ETHIOPIC_NUMERIC;
                    case 'georgian':
                        return LIST_STYLE_TYPE.GEORGIAN;
                    case 'gujarati':
                        return LIST_STYLE_TYPE.GUJARATI;
                    case 'gurmukhi':
                        return LIST_STYLE_TYPE.GURMUKHI;
                    case 'hebrew':
                        return LIST_STYLE_TYPE.HEBREW;
                    case 'hiragana':
                        return LIST_STYLE_TYPE.HIRAGANA;
                    case 'hiragana-iroha':
                        return LIST_STYLE_TYPE.HIRAGANA_IROHA;
                    case 'japanese-formal':
                        return LIST_STYLE_TYPE.JAPANESE_FORMAL;
                    case 'japanese-informal':
                        return LIST_STYLE_TYPE.JAPANESE_INFORMAL;
                    case 'kannada':
                        return LIST_STYLE_TYPE.KANNADA;
                    case 'katakana':
                        return LIST_STYLE_TYPE.KATAKANA;
                    case 'katakana-iroha':
                        return LIST_STYLE_TYPE.KATAKANA_IROHA;
                    case 'khmer':
                        return LIST_STYLE_TYPE.KHMER;
                    case 'korean-hangul-formal':
                        return LIST_STYLE_TYPE.KOREAN_HANGUL_FORMAL;
                    case 'korean-hanja-formal':
                        return LIST_STYLE_TYPE.KOREAN_HANJA_FORMAL;
                    case 'korean-hanja-informal':
                        return LIST_STYLE_TYPE.KOREAN_HANJA_INFORMAL;
                    case 'lao':
                        return LIST_STYLE_TYPE.LAO;
                    case 'lower-armenian':
                        return LIST_STYLE_TYPE.LOWER_ARMENIAN;
                    case 'malayalam':
                        return LIST_STYLE_TYPE.MALAYALAM;
                    case 'mongolian':
                        return LIST_STYLE_TYPE.MONGOLIAN;
                    case 'myanmar':
                        return LIST_STYLE_TYPE.MYANMAR;
                    case 'oriya':
                        return LIST_STYLE_TYPE.ORIYA;
                    case 'persian':
                        return LIST_STYLE_TYPE.PERSIAN;
                    case 'simp-chinese-formal':
                        return LIST_STYLE_TYPE.SIMP_CHINESE_FORMAL;
                    case 'simp-chinese-informal':
                        return LIST_STYLE_TYPE.SIMP_CHINESE_INFORMAL;
                    case 'tamil':
                        return LIST_STYLE_TYPE.TAMIL;
                    case 'telugu':
                        return LIST_STYLE_TYPE.TELUGU;
                    case 'thai':
                        return LIST_STYLE_TYPE.THAI;
                    case 'tibetan':
                        return LIST_STYLE_TYPE.TIBETAN;
                    case 'trad-chinese-formal':
                        return LIST_STYLE_TYPE.TRAD_CHINESE_FORMAL;
                    case 'trad-chinese-informal':
                        return LIST_STYLE_TYPE.TRAD_CHINESE_INFORMAL;
                    case 'upper-armenian':
                        return LIST_STYLE_TYPE.UPPER_ARMENIAN;
                    case 'disclosure-open':
                        return LIST_STYLE_TYPE.DISCLOSURE_OPEN;
                    case 'disclosure-closed':
                        return LIST_STYLE_TYPE.DISCLOSURE_CLOSED;
                    case 'none':
                    default:
                        return LIST_STYLE_TYPE.NONE;
                }
            }
        };

        var marginForSide = function (side) { return ({
            name: "margin-" + side,
            initialValue: '0',
            prefix: false,
            type: PropertyDescriptorParsingType.TOKEN_VALUE
        }); };
        var marginTop = marginForSide('top');
        var marginRight = marginForSide('right');
        var marginBottom = marginForSide('bottom');
        var marginLeft = marginForSide('left');

        var OVERFLOW;
        (function (OVERFLOW) {
            OVERFLOW[OVERFLOW["VISIBLE"] = 0] = "VISIBLE";
            OVERFLOW[OVERFLOW["HIDDEN"] = 1] = "HIDDEN";
            OVERFLOW[OVERFLOW["SCROLL"] = 2] = "SCROLL";
            OVERFLOW[OVERFLOW["AUTO"] = 3] = "AUTO";
        })(OVERFLOW || (OVERFLOW = {}));
        var overflow = {
            name: 'overflow',
            initialValue: 'visible',
            prefix: false,
            type: PropertyDescriptorParsingType.LIST,
            parse: function (tokens) {
                return tokens.filter(isIdentToken).map(function (overflow) {
                    switch (overflow.value) {
                        case 'hidden':
                            return OVERFLOW.HIDDEN;
                        case 'scroll':
                            return OVERFLOW.SCROLL;
                        case 'auto':
                            return OVERFLOW.AUTO;
                        case 'visible':
                        default:
                            return OVERFLOW.VISIBLE;
                    }
                });
            }
        };

        var OVERFLOW_WRAP;
        (function (OVERFLOW_WRAP) {
            OVERFLOW_WRAP["NORMAL"] = "normal";
            OVERFLOW_WRAP["BREAK_WORD"] = "break-word";
        })(OVERFLOW_WRAP || (OVERFLOW_WRAP = {}));
        var overflowWrap = {
            name: 'overflow-wrap',
            initialValue: 'normal',
            prefix: false,
            type: PropertyDescriptorParsingType.IDENT_VALUE,
            parse: function (overflow) {
                switch (overflow) {
                    case 'break-word':
                        return OVERFLOW_WRAP.BREAK_WORD;
                    case 'normal':
                    default:
                        return OVERFLOW_WRAP.NORMAL;
                }
            }
        };

        var paddingForSide = function (side) { return ({
            name: "padding-" + side,
            initialValue: '0',
            prefix: false,
            type: PropertyDescriptorParsingType.TYPE_VALUE,
            format: 'length-percentage'
        }); };
        var paddingTop = paddingForSide('top');
        var paddingRight = paddingForSide('right');
        var paddingBottom = paddingForSide('bottom');
        var paddingLeft = paddingForSide('left');

        var TEXT_ALIGN;
        (function (TEXT_ALIGN) {
            TEXT_ALIGN[TEXT_ALIGN["LEFT"] = 0] = "LEFT";
            TEXT_ALIGN[TEXT_ALIGN["CENTER"] = 1] = "CENTER";
            TEXT_ALIGN[TEXT_ALIGN["RIGHT"] = 2] = "RIGHT";
        })(TEXT_ALIGN || (TEXT_ALIGN = {}));
        var textAlign = {
            name: 'text-align',
            initialValue: 'left',
            prefix: false,
            type: PropertyDescriptorParsingType.IDENT_VALUE,
            parse: function (textAlign) {
                switch (textAlign) {
                    case 'right':
                        return TEXT_ALIGN.RIGHT;
                    case 'center':
                    case 'justify':
                        return TEXT_ALIGN.CENTER;
                    case 'left':
                    default:
                        return TEXT_ALIGN.LEFT;
                }
            }
        };

        var POSITION;
        (function (POSITION) {
            POSITION[POSITION["STATIC"] = 0] = "STATIC";
            POSITION[POSITION["RELATIVE"] = 1] = "RELATIVE";
            POSITION[POSITION["ABSOLUTE"] = 2] = "ABSOLUTE";
            POSITION[POSITION["FIXED"] = 3] = "FIXED";
            POSITION[POSITION["STICKY"] = 4] = "STICKY";
        })(POSITION || (POSITION = {}));
        var position = {
            name: 'position',
            initialValue: 'static',
            prefix: false,
            type: PropertyDescriptorParsingType.IDENT_VALUE,
            parse: function (position) {
                switch (position) {
                    case 'relative':
                        return POSITION.RELATIVE;
                    case 'absolute':
                        return POSITION.ABSOLUTE;
                    case 'fixed':
                        return POSITION.FIXED;
                    case 'sticky':
                        return POSITION.STICKY;
                }
                return POSITION.STATIC;
            }
        };

        var textShadow = {
            name: 'text-shadow',
            initialValue: 'none',
            type: PropertyDescriptorParsingType.LIST,
            prefix: false,
            parse: function (tokens) {
                if (tokens.length === 1 && isIdentWithValue(tokens[0], 'none')) {
                    return [];
                }
                return parseFunctionArgs(tokens).map(function (values) {
                    var shadow = {
                        color: COLORS.TRANSPARENT,
                        offsetX: ZERO_LENGTH,
                        offsetY: ZERO_LENGTH,
                        blur: ZERO_LENGTH
                    };
                    var c = 0;
                    for (var i = 0; i < values.length; i++) {
                        var token = values[i];
                        if (isLength(token)) {
                            if (c === 0) {
                                shadow.offsetX = token;
                            }
                            else if (c === 1) {
                                shadow.offsetY = token;
                            }
                            else {
                                shadow.blur = token;
                            }
                            c++;
                        }
                        else {
                            shadow.color = color$1.parse(token);
                        }
                    }
                    return shadow;
                });
            }
        };

        var TEXT_TRANSFORM;
        (function (TEXT_TRANSFORM) {
            TEXT_TRANSFORM[TEXT_TRANSFORM["NONE"] = 0] = "NONE";
            TEXT_TRANSFORM[TEXT_TRANSFORM["LOWERCASE"] = 1] = "LOWERCASE";
            TEXT_TRANSFORM[TEXT_TRANSFORM["UPPERCASE"] = 2] = "UPPERCASE";
            TEXT_TRANSFORM[TEXT_TRANSFORM["CAPITALIZE"] = 3] = "CAPITALIZE";
        })(TEXT_TRANSFORM || (TEXT_TRANSFORM = {}));
        var textTransform = {
            name: 'text-transform',
            initialValue: 'none',
            prefix: false,
            type: PropertyDescriptorParsingType.IDENT_VALUE,
            parse: function (textTransform) {
                switch (textTransform) {
                    case 'uppercase':
                        return TEXT_TRANSFORM.UPPERCASE;
                    case 'lowercase':
                        return TEXT_TRANSFORM.LOWERCASE;
                    case 'capitalize':
                        return TEXT_TRANSFORM.CAPITALIZE;
                }
                return TEXT_TRANSFORM.NONE;
            }
        };

        var transform$1 = {
            name: 'transform',
            initialValue: 'none',
            prefix: true,
            type: PropertyDescriptorParsingType.VALUE,
            parse: function (token) {
                if (token.type === TokenType.IDENT_TOKEN && token.value === 'none') {
                    return null;
                }
                if (token.type === TokenType.FUNCTION) {
                    var transformFunction = SUPPORTED_TRANSFORM_FUNCTIONS[token.name];
                    if (typeof transformFunction === 'undefined') {
                        throw new Error("Attempting to parse an unsupported transform function \"" + token.name + "\"");
                    }
                    return transformFunction(token.values);
                }
                return null;
            }
        };
        var matrix = function (args) {
            var values = args.filter(function (arg) { return arg.type === TokenType.NUMBER_TOKEN; }).map(function (arg) { return arg.number; });
            return values.length === 6 ? values : null;
        };
        // doesn't support 3D transforms at the moment
        var matrix3d = function (args) {
            var values = args.filter(function (arg) { return arg.type === TokenType.NUMBER_TOKEN; }).map(function (arg) { return arg.number; });
            var a1 = values[0], b1 = values[1]; values[2]; values[3]; var a2 = values[4], b2 = values[5]; values[6]; values[7]; values[8]; values[9]; values[10]; values[11]; var a4 = values[12], b4 = values[13]; values[14]; values[15];
            return values.length === 16 ? [a1, b1, a2, b2, a4, b4] : null;
        };
        var SUPPORTED_TRANSFORM_FUNCTIONS = {
            matrix: matrix,
            matrix3d: matrix3d
        };

        var DEFAULT_VALUE = {
            type: TokenType.PERCENTAGE_TOKEN,
            number: 50,
            flags: FLAG_INTEGER
        };
        var DEFAULT = [DEFAULT_VALUE, DEFAULT_VALUE];
        var transformOrigin = {
            name: 'transform-origin',
            initialValue: '50% 50%',
            prefix: true,
            type: PropertyDescriptorParsingType.LIST,
            parse: function (tokens) {
                var origins = tokens.filter(isLengthPercentage);
                if (origins.length !== 2) {
                    return DEFAULT;
                }
                return [origins[0], origins[1]];
            }
        };

        var VISIBILITY;
        (function (VISIBILITY) {
            VISIBILITY[VISIBILITY["VISIBLE"] = 0] = "VISIBLE";
            VISIBILITY[VISIBILITY["HIDDEN"] = 1] = "HIDDEN";
            VISIBILITY[VISIBILITY["COLLAPSE"] = 2] = "COLLAPSE";
        })(VISIBILITY || (VISIBILITY = {}));
        var visibility = {
            name: 'visible',
            initialValue: 'none',
            prefix: false,
            type: PropertyDescriptorParsingType.IDENT_VALUE,
            parse: function (visibility) {
                switch (visibility) {
                    case 'hidden':
                        return VISIBILITY.HIDDEN;
                    case 'collapse':
                        return VISIBILITY.COLLAPSE;
                    case 'visible':
                    default:
                        return VISIBILITY.VISIBLE;
                }
            }
        };

        var WORD_BREAK;
        (function (WORD_BREAK) {
            WORD_BREAK["NORMAL"] = "normal";
            WORD_BREAK["BREAK_ALL"] = "break-all";
            WORD_BREAK["KEEP_ALL"] = "keep-all";
        })(WORD_BREAK || (WORD_BREAK = {}));
        var wordBreak = {
            name: 'word-break',
            initialValue: 'normal',
            prefix: false,
            type: PropertyDescriptorParsingType.IDENT_VALUE,
            parse: function (wordBreak) {
                switch (wordBreak) {
                    case 'break-all':
                        return WORD_BREAK.BREAK_ALL;
                    case 'keep-all':
                        return WORD_BREAK.KEEP_ALL;
                    case 'normal':
                    default:
                        return WORD_BREAK.NORMAL;
                }
            }
        };

        var zIndex = {
            name: 'z-index',
            initialValue: 'auto',
            prefix: false,
            type: PropertyDescriptorParsingType.VALUE,
            parse: function (token) {
                if (token.type === TokenType.IDENT_TOKEN) {
                    return { auto: true, order: 0 };
                }
                if (isNumberToken(token)) {
                    return { auto: false, order: token.number };
                }
                throw new Error("Invalid z-index number parsed");
            }
        };

        var opacity = {
            name: 'opacity',
            initialValue: '1',
            type: PropertyDescriptorParsingType.VALUE,
            prefix: false,
            parse: function (token) {
                if (isNumberToken(token)) {
                    return token.number;
                }
                return 1;
            }
        };

        var textDecorationColor = {
            name: "text-decoration-color",
            initialValue: 'transparent',
            prefix: false,
            type: PropertyDescriptorParsingType.TYPE_VALUE,
            format: 'color'
        };

        var textDecorationLine = {
            name: 'text-decoration-line',
            initialValue: 'none',
            prefix: false,
            type: PropertyDescriptorParsingType.LIST,
            parse: function (tokens) {
                return tokens
                    .filter(isIdentToken)
                    .map(function (token) {
                    switch (token.value) {
                        case 'underline':
                            return 1 /* UNDERLINE */;
                        case 'overline':
                            return 2 /* OVERLINE */;
                        case 'line-through':
                            return 3 /* LINE_THROUGH */;
                        case 'none':
                            return 4 /* BLINK */;
                    }
                    return 0 /* NONE */;
                })
                    .filter(function (line) { return line !== 0 /* NONE */; });
            }
        };

        var fontFamily = {
            name: "font-family",
            initialValue: '',
            prefix: false,
            type: PropertyDescriptorParsingType.LIST,
            parse: function (tokens) {
                var accumulator = [];
                var results = [];
                tokens.forEach(function (token) {
                    switch (token.type) {
                        case TokenType.IDENT_TOKEN:
                        case TokenType.STRING_TOKEN:
                            accumulator.push(token.value);
                            break;
                        case TokenType.NUMBER_TOKEN:
                            accumulator.push(token.number.toString());
                            break;
                        case TokenType.COMMA_TOKEN:
                            results.push(accumulator.join(' '));
                            accumulator.length = 0;
                            break;
                    }
                });
                if (accumulator.length) {
                    results.push(accumulator.join(' '));
                }
                return results.map(function (result) { return (result.indexOf(' ') === -1 ? result : "'" + result + "'"); });
            }
        };

        var fontSize = {
            name: "font-size",
            initialValue: '0',
            prefix: false,
            type: PropertyDescriptorParsingType.TYPE_VALUE,
            format: 'length'
        };

        var fontWeight = {
            name: 'font-weight',
            initialValue: 'normal',
            type: PropertyDescriptorParsingType.VALUE,
            prefix: false,
            parse: function (token) {
                if (isNumberToken(token)) {
                    return token.number;
                }
                if (isIdentToken(token)) {
                    switch (token.value) {
                        case 'bold':
                            return 700;
                        case 'normal':
                        default:
                            return 400;
                    }
                }
                return 400;
            }
        };

        var fontVariant = {
            name: 'font-variant',
            initialValue: 'none',
            type: PropertyDescriptorParsingType.LIST,
            prefix: false,
            parse: function (tokens) {
                return tokens.filter(isIdentToken).map(function (token) { return token.value; });
            }
        };

        var FONT_STYLE;
        (function (FONT_STYLE) {
            FONT_STYLE["NORMAL"] = "normal";
            FONT_STYLE["ITALIC"] = "italic";
            FONT_STYLE["OBLIQUE"] = "oblique";
        })(FONT_STYLE || (FONT_STYLE = {}));
        var fontStyle = {
            name: 'font-style',
            initialValue: 'normal',
            prefix: false,
            type: PropertyDescriptorParsingType.IDENT_VALUE,
            parse: function (overflow) {
                switch (overflow) {
                    case 'oblique':
                        return FONT_STYLE.OBLIQUE;
                    case 'italic':
                        return FONT_STYLE.ITALIC;
                    case 'normal':
                    default:
                        return FONT_STYLE.NORMAL;
                }
            }
        };

        var contains = function (bit, value) { return (bit & value) !== 0; };

        var content = {
            name: 'content',
            initialValue: 'none',
            type: PropertyDescriptorParsingType.LIST,
            prefix: false,
            parse: function (tokens) {
                if (tokens.length === 0) {
                    return [];
                }
                var first = tokens[0];
                if (first.type === TokenType.IDENT_TOKEN && first.value === 'none') {
                    return [];
                }
                return tokens;
            }
        };

        var counterIncrement = {
            name: 'counter-increment',
            initialValue: 'none',
            prefix: true,
            type: PropertyDescriptorParsingType.LIST,
            parse: function (tokens) {
                if (tokens.length === 0) {
                    return null;
                }
                var first = tokens[0];
                if (first.type === TokenType.IDENT_TOKEN && first.value === 'none') {
                    return null;
                }
                var increments = [];
                var filtered = tokens.filter(nonWhiteSpace);
                for (var i = 0; i < filtered.length; i++) {
                    var counter = filtered[i];
                    var next = filtered[i + 1];
                    if (counter.type === TokenType.IDENT_TOKEN) {
                        var increment = next && isNumberToken(next) ? next.number : 1;
                        increments.push({ counter: counter.value, increment: increment });
                    }
                }
                return increments;
            }
        };

        var counterReset = {
            name: 'counter-reset',
            initialValue: 'none',
            prefix: true,
            type: PropertyDescriptorParsingType.LIST,
            parse: function (tokens) {
                if (tokens.length === 0) {
                    return [];
                }
                var resets = [];
                var filtered = tokens.filter(nonWhiteSpace);
                for (var i = 0; i < filtered.length; i++) {
                    var counter = filtered[i];
                    var next = filtered[i + 1];
                    if (isIdentToken(counter) && counter.value !== 'none') {
                        var reset = next && isNumberToken(next) ? next.number : 0;
                        resets.push({ counter: counter.value, reset: reset });
                    }
                }
                return resets;
            }
        };

        var quotes = {
            name: 'quotes',
            initialValue: 'none',
            prefix: true,
            type: PropertyDescriptorParsingType.LIST,
            parse: function (tokens) {
                if (tokens.length === 0) {
                    return null;
                }
                var first = tokens[0];
                if (first.type === TokenType.IDENT_TOKEN && first.value === 'none') {
                    return null;
                }
                var quotes = [];
                var filtered = tokens.filter(isStringToken);
                if (filtered.length % 2 !== 0) {
                    return null;
                }
                for (var i = 0; i < filtered.length; i += 2) {
                    var open_1 = filtered[i].value;
                    var close_1 = filtered[i + 1].value;
                    quotes.push({ open: open_1, close: close_1 });
                }
                return quotes;
            }
        };
        var getQuote = function (quotes, depth, open) {
            if (!quotes) {
                return '';
            }
            var quote = quotes[Math.min(depth, quotes.length - 1)];
            if (!quote) {
                return '';
            }
            return open ? quote.open : quote.close;
        };

        var boxShadow = {
            name: 'box-shadow',
            initialValue: 'none',
            type: PropertyDescriptorParsingType.LIST,
            prefix: false,
            parse: function (tokens) {
                if (tokens.length === 1 && isIdentWithValue(tokens[0], 'none')) {
                    return [];
                }
                return parseFunctionArgs(tokens).map(function (values) {
                    var shadow = {
                        color: 0x000000ff,
                        offsetX: ZERO_LENGTH,
                        offsetY: ZERO_LENGTH,
                        blur: ZERO_LENGTH,
                        spread: ZERO_LENGTH,
                        inset: false
                    };
                    var c = 0;
                    for (var i = 0; i < values.length; i++) {
                        var token = values[i];
                        if (isIdentWithValue(token, 'inset')) {
                            shadow.inset = true;
                        }
                        else if (isLength(token)) {
                            if (c === 0) {
                                shadow.offsetX = token;
                            }
                            else if (c === 1) {
                                shadow.offsetY = token;
                            }
                            else if (c === 2) {
                                shadow.blur = token;
                            }
                            else {
                                shadow.spread = token;
                            }
                            c++;
                        }
                        else {
                            shadow.color = color$1.parse(token);
                        }
                    }
                    return shadow;
                });
            }
        };

        var PAINT_ORDER_LAYER;
        (function (PAINT_ORDER_LAYER) {
            PAINT_ORDER_LAYER[PAINT_ORDER_LAYER["FILL"] = 0] = "FILL";
            PAINT_ORDER_LAYER[PAINT_ORDER_LAYER["STROKE"] = 1] = "STROKE";
            PAINT_ORDER_LAYER[PAINT_ORDER_LAYER["MARKERS"] = 2] = "MARKERS";
        })(PAINT_ORDER_LAYER || (PAINT_ORDER_LAYER = {}));
        var paintOrder = {
            name: 'paint-order',
            initialValue: 'normal',
            prefix: false,
            type: PropertyDescriptorParsingType.LIST,
            parse: function (tokens) {
                var DEFAULT_VALUE = [PAINT_ORDER_LAYER.FILL, PAINT_ORDER_LAYER.STROKE, PAINT_ORDER_LAYER.MARKERS];
                var layers = [];
                tokens.filter(isIdentToken).forEach(function (token) {
                    switch (token.value) {
                        case 'stroke':
                            layers.push(PAINT_ORDER_LAYER.STROKE);
                            break;
                        case 'fill':
                            layers.push(PAINT_ORDER_LAYER.FILL);
                            break;
                        case 'markers':
                            layers.push(PAINT_ORDER_LAYER.MARKERS);
                            break;
                    }
                });
                DEFAULT_VALUE.forEach(function (value) {
                    if (layers.indexOf(value) === -1) {
                        layers.push(value);
                    }
                });
                return layers;
            }
        };

        var webkitTextStrokeColor = {
            name: "-webkit-text-stroke-color",
            initialValue: 'currentcolor',
            prefix: false,
            type: PropertyDescriptorParsingType.TYPE_VALUE,
            format: 'color'
        };

        var webkitTextStrokeWidth = {
            name: "-webkit-text-stroke-width",
            initialValue: '0',
            type: PropertyDescriptorParsingType.VALUE,
            prefix: false,
            parse: function (token) {
                if (isDimensionToken(token)) {
                    return token.number;
                }
                return 0;
            }
        };

        var CSSParsedDeclaration = /** @class */ (function () {
            function CSSParsedDeclaration(declaration) {
                var _a, _b;
                this.backgroundClip = parse(backgroundClip, declaration.backgroundClip);
                this.backgroundColor = parse(backgroundColor, declaration.backgroundColor);
                this.backgroundImage = parse(backgroundImage, declaration.backgroundImage);
                this.backgroundOrigin = parse(backgroundOrigin, declaration.backgroundOrigin);
                this.backgroundPosition = parse(backgroundPosition, declaration.backgroundPosition);
                this.backgroundRepeat = parse(backgroundRepeat, declaration.backgroundRepeat);
                this.backgroundSize = parse(backgroundSize, declaration.backgroundSize);
                this.borderTopColor = parse(borderTopColor, declaration.borderTopColor);
                this.borderRightColor = parse(borderRightColor, declaration.borderRightColor);
                this.borderBottomColor = parse(borderBottomColor, declaration.borderBottomColor);
                this.borderLeftColor = parse(borderLeftColor, declaration.borderLeftColor);
                this.borderTopLeftRadius = parse(borderTopLeftRadius, declaration.borderTopLeftRadius);
                this.borderTopRightRadius = parse(borderTopRightRadius, declaration.borderTopRightRadius);
                this.borderBottomRightRadius = parse(borderBottomRightRadius, declaration.borderBottomRightRadius);
                this.borderBottomLeftRadius = parse(borderBottomLeftRadius, declaration.borderBottomLeftRadius);
                this.borderTopStyle = parse(borderTopStyle, declaration.borderTopStyle);
                this.borderRightStyle = parse(borderRightStyle, declaration.borderRightStyle);
                this.borderBottomStyle = parse(borderBottomStyle, declaration.borderBottomStyle);
                this.borderLeftStyle = parse(borderLeftStyle, declaration.borderLeftStyle);
                this.borderTopWidth = parse(borderTopWidth, declaration.borderTopWidth);
                this.borderRightWidth = parse(borderRightWidth, declaration.borderRightWidth);
                this.borderBottomWidth = parse(borderBottomWidth, declaration.borderBottomWidth);
                this.borderLeftWidth = parse(borderLeftWidth, declaration.borderLeftWidth);
                this.boxShadow = parse(boxShadow, declaration.boxShadow);
                this.color = parse(color, declaration.color);
                this.display = parse(display, declaration.display);
                this.float = parse(float, declaration.cssFloat);
                this.fontFamily = parse(fontFamily, declaration.fontFamily);
                this.fontSize = parse(fontSize, declaration.fontSize);
                this.fontStyle = parse(fontStyle, declaration.fontStyle);
                this.fontVariant = parse(fontVariant, declaration.fontVariant);
                this.fontWeight = parse(fontWeight, declaration.fontWeight);
                this.letterSpacing = parse(letterSpacing, declaration.letterSpacing);
                this.lineBreak = parse(lineBreak, declaration.lineBreak);
                this.lineHeight = parse(lineHeight, declaration.lineHeight);
                this.listStyleImage = parse(listStyleImage, declaration.listStyleImage);
                this.listStylePosition = parse(listStylePosition, declaration.listStylePosition);
                this.listStyleType = parse(listStyleType, declaration.listStyleType);
                this.marginTop = parse(marginTop, declaration.marginTop);
                this.marginRight = parse(marginRight, declaration.marginRight);
                this.marginBottom = parse(marginBottom, declaration.marginBottom);
                this.marginLeft = parse(marginLeft, declaration.marginLeft);
                this.opacity = parse(opacity, declaration.opacity);
                var overflowTuple = parse(overflow, declaration.overflow);
                this.overflowX = overflowTuple[0];
                this.overflowY = overflowTuple[overflowTuple.length > 1 ? 1 : 0];
                this.overflowWrap = parse(overflowWrap, declaration.overflowWrap);
                this.paddingTop = parse(paddingTop, declaration.paddingTop);
                this.paddingRight = parse(paddingRight, declaration.paddingRight);
                this.paddingBottom = parse(paddingBottom, declaration.paddingBottom);
                this.paddingLeft = parse(paddingLeft, declaration.paddingLeft);
                this.paintOrder = parse(paintOrder, declaration.paintOrder);
                this.position = parse(position, declaration.position);
                this.textAlign = parse(textAlign, declaration.textAlign);
                this.textDecorationColor = parse(textDecorationColor, (_a = declaration.textDecorationColor) !== null && _a !== void 0 ? _a : declaration.color);
                this.textDecorationLine = parse(textDecorationLine, (_b = declaration.textDecorationLine) !== null && _b !== void 0 ? _b : declaration.textDecoration);
                this.textShadow = parse(textShadow, declaration.textShadow);
                this.textTransform = parse(textTransform, declaration.textTransform);
                this.transform = parse(transform$1, declaration.transform);
                this.transformOrigin = parse(transformOrigin, declaration.transformOrigin);
                this.visibility = parse(visibility, declaration.visibility);
                this.webkitTextStrokeColor = parse(webkitTextStrokeColor, declaration.webkitTextStrokeColor);
                this.webkitTextStrokeWidth = parse(webkitTextStrokeWidth, declaration.webkitTextStrokeWidth);
                this.wordBreak = parse(wordBreak, declaration.wordBreak);
                this.zIndex = parse(zIndex, declaration.zIndex);
            }
            CSSParsedDeclaration.prototype.isVisible = function () {
                return this.display > 0 && this.opacity > 0 && this.visibility === VISIBILITY.VISIBLE;
            };
            CSSParsedDeclaration.prototype.isTransparent = function () {
                return isTransparent(this.backgroundColor);
            };
            CSSParsedDeclaration.prototype.isTransformed = function () {
                return this.transform !== null;
            };
            CSSParsedDeclaration.prototype.isPositioned = function () {
                return this.position !== POSITION.STATIC;
            };
            CSSParsedDeclaration.prototype.isPositionedWithZIndex = function () {
                return this.isPositioned() && !this.zIndex.auto;
            };
            CSSParsedDeclaration.prototype.isFloating = function () {
                return this.float !== FLOAT.NONE;
            };
            CSSParsedDeclaration.prototype.isInlineLevel = function () {
                return (contains(this.display, 4 /* INLINE */) ||
                    contains(this.display, 33554432 /* INLINE_BLOCK */) ||
                    contains(this.display, 268435456 /* INLINE_FLEX */) ||
                    contains(this.display, 536870912 /* INLINE_GRID */) ||
                    contains(this.display, 67108864 /* INLINE_LIST_ITEM */) ||
                    contains(this.display, 134217728 /* INLINE_TABLE */));
            };
            return CSSParsedDeclaration;
        }());
        var CSSParsedPseudoDeclaration = /** @class */ (function () {
            function CSSParsedPseudoDeclaration(declaration) {
                this.content = parse(content, declaration.content);
                this.quotes = parse(quotes, declaration.quotes);
            }
            return CSSParsedPseudoDeclaration;
        }());
        var CSSParsedCounterDeclaration = /** @class */ (function () {
            function CSSParsedCounterDeclaration(declaration) {
                this.counterIncrement = parse(counterIncrement, declaration.counterIncrement);
                this.counterReset = parse(counterReset, declaration.counterReset);
            }
            return CSSParsedCounterDeclaration;
        }());
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        var parse = function (descriptor, style) {
            var tokenizer = new Tokenizer();
            var value = style !== null && typeof style !== 'undefined' ? style.toString() : descriptor.initialValue;
            tokenizer.write(value);
            var parser = new Parser(tokenizer.read());
            switch (descriptor.type) {
                case PropertyDescriptorParsingType.IDENT_VALUE:
                    var token = parser.parseComponentValue();
                    return descriptor.parse(isIdentToken(token) ? token.value : descriptor.initialValue);
                case PropertyDescriptorParsingType.VALUE:
                    return descriptor.parse(parser.parseComponentValue());
                case PropertyDescriptorParsingType.LIST:
                    return descriptor.parse(parser.parseComponentValues());
                case PropertyDescriptorParsingType.TOKEN_VALUE:
                    return parser.parseComponentValue();
                case PropertyDescriptorParsingType.TYPE_VALUE:
                    switch (descriptor.format) {
                        case 'angle':
                            return angle.parse(parser.parseComponentValue());
                        case 'color':
                            return color$1.parse(parser.parseComponentValue());
                        case 'image':
                            return image.parse(parser.parseComponentValue());
                        case 'length':
                            var length_1 = parser.parseComponentValue();
                            return isLength(length_1) ? length_1 : ZERO_LENGTH;
                        case 'length-percentage':
                            var value_1 = parser.parseComponentValue();
                            return isLengthPercentage(value_1) ? value_1 : ZERO_LENGTH;
                    }
                    break;
            }
        };

        var ElementContainer = /** @class */ (function () {
            function ElementContainer(element) {
                this.styles = new CSSParsedDeclaration(window.getComputedStyle(element, null));
                this.textNodes = [];
                this.elements = [];
                if (this.styles.transform !== null && isHTMLElementNode(element)) {
                    // getBoundingClientRect takes transforms into account
                    element.style.transform = 'none';
                }
                this.bounds = parseBounds(element);
                this.flags = 0;
            }
            return ElementContainer;
        }());

        var TextBounds = /** @class */ (function () {
            function TextBounds(text, bounds) {
                this.text = text;
                this.bounds = bounds;
            }
            return TextBounds;
        }());
        var parseTextBounds = function (value, styles, node) {
            var textList = breakText(value, styles);
            var textBounds = [];
            var offset = 0;
            textList.forEach(function (text) {
                if (styles.textDecorationLine.length || text.trim().length > 0) {
                    if (FEATURES.SUPPORT_RANGE_BOUNDS) {
                        textBounds.push(new TextBounds(text, getRangeBounds(node, offset, text.length)));
                    }
                    else {
                        var replacementNode = node.splitText(text.length);
                        textBounds.push(new TextBounds(text, getWrapperBounds(node)));
                        node = replacementNode;
                    }
                }
                else if (!FEATURES.SUPPORT_RANGE_BOUNDS) {
                    node = node.splitText(text.length);
                }
                offset += text.length;
            });
            return textBounds;
        };
        var getWrapperBounds = function (node) {
            var ownerDocument = node.ownerDocument;
            if (ownerDocument) {
                var wrapper = ownerDocument.createElement('html2canvaswrapper');
                wrapper.appendChild(node.cloneNode(true));
                var parentNode = node.parentNode;
                if (parentNode) {
                    parentNode.replaceChild(wrapper, node);
                    var bounds = parseBounds(wrapper);
                    if (wrapper.firstChild) {
                        parentNode.replaceChild(wrapper.firstChild, wrapper);
                    }
                    return bounds;
                }
            }
            return new Bounds(0, 0, 0, 0);
        };
        var getRangeBounds = function (node, offset, length) {
            var ownerDocument = node.ownerDocument;
            if (!ownerDocument) {
                throw new Error('Node has no owner document');
            }
            var range = ownerDocument.createRange();
            range.setStart(node, offset);
            range.setEnd(node, offset + length);
            return Bounds.fromClientRect(range.getBoundingClientRect());
        };
        var breakText = function (value, styles) {
            return styles.letterSpacing !== 0 ? toCodePoints(value).map(function (i) { return fromCodePoint(i); }) : breakWords(value, styles);
        };
        // https://drafts.csswg.org/css-text/#word-separator
        var wordSeparators = [0x0020, 0x00a0, 0x1361, 0x10100, 0x10101, 0x1039, 0x1091];
        var breakWords = function (str, styles) {
            var breaker = LineBreaker(str, {
                lineBreak: styles.lineBreak,
                wordBreak: styles.overflowWrap === OVERFLOW_WRAP.BREAK_WORD ? 'break-word' : styles.wordBreak
            });
            var words = [];
            var bk;
            var _loop_1 = function () {
                if (bk.value) {
                    var value = bk.value.slice();
                    var codePoints = toCodePoints(value);
                    var word_1 = '';
                    codePoints.forEach(function (codePoint) {
                        if (wordSeparators.indexOf(codePoint) === -1) {
                            word_1 += fromCodePoint(codePoint);
                        }
                        else {
                            if (word_1.length) {
                                words.push(word_1);
                            }
                            words.push(fromCodePoint(codePoint));
                            word_1 = '';
                        }
                    });
                    if (word_1.length) {
                        words.push(word_1);
                    }
                }
            };
            while (!(bk = breaker.next()).done) {
                _loop_1();
            }
            return words;
        };

        var TextContainer = /** @class */ (function () {
            function TextContainer(node, styles) {
                this.text = transform(node.data, styles.textTransform);
                this.textBounds = parseTextBounds(this.text, styles, node);
            }
            return TextContainer;
        }());
        var transform = function (text, transform) {
            switch (transform) {
                case TEXT_TRANSFORM.LOWERCASE:
                    return text.toLowerCase();
                case TEXT_TRANSFORM.CAPITALIZE:
                    return text.replace(CAPITALIZE, capitalize);
                case TEXT_TRANSFORM.UPPERCASE:
                    return text.toUpperCase();
                default:
                    return text;
            }
        };
        var CAPITALIZE = /(^|\s|:|-|\(|\))([a-z])/g;
        var capitalize = function (m, p1, p2) {
            if (m.length > 0) {
                return p1 + p2.toUpperCase();
            }
            return m;
        };

        var ImageElementContainer = /** @class */ (function (_super) {
            __extends(ImageElementContainer, _super);
            function ImageElementContainer(img) {
                var _this = _super.call(this, img) || this;
                _this.src = img.currentSrc || img.src;
                _this.intrinsicWidth = img.naturalWidth;
                _this.intrinsicHeight = img.naturalHeight;
                CacheStorage.getInstance().addImage(_this.src);
                return _this;
            }
            return ImageElementContainer;
        }(ElementContainer));

        var CanvasElementContainer = /** @class */ (function (_super) {
            __extends(CanvasElementContainer, _super);
            function CanvasElementContainer(canvas) {
                var _this = _super.call(this, canvas) || this;
                _this.canvas = canvas;
                _this.intrinsicWidth = canvas.width;
                _this.intrinsicHeight = canvas.height;
                return _this;
            }
            return CanvasElementContainer;
        }(ElementContainer));

        var SVGElementContainer = /** @class */ (function (_super) {
            __extends(SVGElementContainer, _super);
            function SVGElementContainer(img) {
                var _this = _super.call(this, img) || this;
                var s = new XMLSerializer();
                var bounds = parseBounds(img);
                img.setAttribute('width', bounds.width + "px");
                img.setAttribute('height', bounds.height + "px");
                _this.svg = "data:image/svg+xml," + encodeURIComponent(s.serializeToString(img));
                _this.intrinsicWidth = img.width.baseVal.value;
                _this.intrinsicHeight = img.height.baseVal.value;
                CacheStorage.getInstance().addImage(_this.svg);
                return _this;
            }
            return SVGElementContainer;
        }(ElementContainer));

        var LIElementContainer = /** @class */ (function (_super) {
            __extends(LIElementContainer, _super);
            function LIElementContainer(element) {
                var _this = _super.call(this, element) || this;
                _this.value = element.value;
                return _this;
            }
            return LIElementContainer;
        }(ElementContainer));

        var OLElementContainer = /** @class */ (function (_super) {
            __extends(OLElementContainer, _super);
            function OLElementContainer(element) {
                var _this = _super.call(this, element) || this;
                _this.start = element.start;
                _this.reversed = typeof element.reversed === 'boolean' && element.reversed === true;
                return _this;
            }
            return OLElementContainer;
        }(ElementContainer));

        var CHECKBOX_BORDER_RADIUS = [
            {
                type: TokenType.DIMENSION_TOKEN,
                flags: 0,
                unit: 'px',
                number: 3
            }
        ];
        var RADIO_BORDER_RADIUS = [
            {
                type: TokenType.PERCENTAGE_TOKEN,
                flags: 0,
                number: 50
            }
        ];
        var reformatInputBounds = function (bounds) {
            if (bounds.width > bounds.height) {
                return new Bounds(bounds.left + (bounds.width - bounds.height) / 2, bounds.top, bounds.height, bounds.height);
            }
            else if (bounds.width < bounds.height) {
                return new Bounds(bounds.left, bounds.top + (bounds.height - bounds.width) / 2, bounds.width, bounds.width);
            }
            return bounds;
        };
        var getInputValue = function (node) {
            var value = node.type === PASSWORD ? new Array(node.value.length + 1).join('\u2022') : node.value;
            return value.length === 0 ? node.placeholder || '' : value;
        };
        var CHECKBOX = 'checkbox';
        var RADIO = 'radio';
        var PASSWORD = 'password';
        var INPUT_COLOR = 0x2a2a2aff;
        var InputElementContainer = /** @class */ (function (_super) {
            __extends(InputElementContainer, _super);
            function InputElementContainer(input) {
                var _this = _super.call(this, input) || this;
                _this.type = input.type.toLowerCase();
                _this.checked = input.checked;
                _this.value = getInputValue(input);
                if (_this.type === CHECKBOX || _this.type === RADIO) {
                    _this.styles.backgroundColor = 0xdededeff;
                    _this.styles.borderTopColor =
                        _this.styles.borderRightColor =
                            _this.styles.borderBottomColor =
                                _this.styles.borderLeftColor =
                                    0xa5a5a5ff;
                    _this.styles.borderTopWidth =
                        _this.styles.borderRightWidth =
                            _this.styles.borderBottomWidth =
                                _this.styles.borderLeftWidth =
                                    1;
                    _this.styles.borderTopStyle =
                        _this.styles.borderRightStyle =
                            _this.styles.borderBottomStyle =
                                _this.styles.borderLeftStyle =
                                    BORDER_STYLE.SOLID;
                    _this.styles.backgroundClip = [BACKGROUND_CLIP.BORDER_BOX];
                    _this.styles.backgroundOrigin = [0 /* BORDER_BOX */];
                    _this.bounds = reformatInputBounds(_this.bounds);
                }
                switch (_this.type) {
                    case CHECKBOX:
                        _this.styles.borderTopRightRadius =
                            _this.styles.borderTopLeftRadius =
                                _this.styles.borderBottomRightRadius =
                                    _this.styles.borderBottomLeftRadius =
                                        CHECKBOX_BORDER_RADIUS;
                        break;
                    case RADIO:
                        _this.styles.borderTopRightRadius =
                            _this.styles.borderTopLeftRadius =
                                _this.styles.borderBottomRightRadius =
                                    _this.styles.borderBottomLeftRadius =
                                        RADIO_BORDER_RADIUS;
                        break;
                }
                return _this;
            }
            return InputElementContainer;
        }(ElementContainer));

        var SelectElementContainer = /** @class */ (function (_super) {
            __extends(SelectElementContainer, _super);
            function SelectElementContainer(element) {
                var _this = _super.call(this, element) || this;
                var option = element.options[element.selectedIndex || 0];
                _this.value = option ? option.text || '' : '';
                return _this;
            }
            return SelectElementContainer;
        }(ElementContainer));

        var TextareaElementContainer = /** @class */ (function (_super) {
            __extends(TextareaElementContainer, _super);
            function TextareaElementContainer(element) {
                var _this = _super.call(this, element) || this;
                _this.value = element.value;
                return _this;
            }
            return TextareaElementContainer;
        }(ElementContainer));

        var parseColor$1 = function (value) { return color$1.parse(Parser.create(value).parseComponentValue()); };
        var IFrameElementContainer = /** @class */ (function (_super) {
            __extends(IFrameElementContainer, _super);
            function IFrameElementContainer(iframe) {
                var _this = _super.call(this, iframe) || this;
                _this.src = iframe.src;
                _this.width = parseInt(iframe.width, 10) || 0;
                _this.height = parseInt(iframe.height, 10) || 0;
                _this.backgroundColor = _this.styles.backgroundColor;
                try {
                    if (iframe.contentWindow &&
                        iframe.contentWindow.document &&
                        iframe.contentWindow.document.documentElement) {
                        _this.tree = parseTree(iframe.contentWindow.document.documentElement);
                        // http://www.w3.org/TR/css3-background/#special-backgrounds
                        var documentBackgroundColor = iframe.contentWindow.document.documentElement
                            ? parseColor$1(getComputedStyle(iframe.contentWindow.document.documentElement).backgroundColor)
                            : COLORS.TRANSPARENT;
                        var bodyBackgroundColor = iframe.contentWindow.document.body
                            ? parseColor$1(getComputedStyle(iframe.contentWindow.document.body).backgroundColor)
                            : COLORS.TRANSPARENT;
                        _this.backgroundColor = isTransparent(documentBackgroundColor)
                            ? isTransparent(bodyBackgroundColor)
                                ? _this.styles.backgroundColor
                                : bodyBackgroundColor
                            : documentBackgroundColor;
                    }
                }
                catch (e) { }
                return _this;
            }
            return IFrameElementContainer;
        }(ElementContainer));

        var LIST_OWNERS = ['OL', 'UL', 'MENU'];
        var parseNodeTree = function (node, parent, root) {
            for (var childNode = node.firstChild, nextNode = void 0; childNode; childNode = nextNode) {
                nextNode = childNode.nextSibling;
                if (isTextNode(childNode) && childNode.data.trim().length > 0) {
                    parent.textNodes.push(new TextContainer(childNode, parent.styles));
                }
                else if (isElementNode(childNode)) {
                    if (isSlotElement(childNode) && childNode.assignedNodes) {
                        childNode.assignedNodes().forEach(function (childNode) { return parseNodeTree(childNode, parent, root); });
                    }
                    else {
                        var container = createContainer(childNode);
                        if (container.styles.isVisible()) {
                            if (createsRealStackingContext(childNode, container, root)) {
                                container.flags |= 4 /* CREATES_REAL_STACKING_CONTEXT */;
                            }
                            else if (createsStackingContext(container.styles)) {
                                container.flags |= 2 /* CREATES_STACKING_CONTEXT */;
                            }
                            if (LIST_OWNERS.indexOf(childNode.tagName) !== -1) {
                                container.flags |= 8 /* IS_LIST_OWNER */;
                            }
                            parent.elements.push(container);
                            childNode.slot;
                            if (childNode.shadowRoot) {
                                parseNodeTree(childNode.shadowRoot, container, root);
                            }
                            else if (!isTextareaElement(childNode) &&
                                !isSVGElement(childNode) &&
                                !isSelectElement(childNode)) {
                                parseNodeTree(childNode, container, root);
                            }
                        }
                    }
                }
            }
        };
        var createContainer = function (element) {
            if (isImageElement(element)) {
                return new ImageElementContainer(element);
            }
            if (isCanvasElement(element)) {
                return new CanvasElementContainer(element);
            }
            if (isSVGElement(element)) {
                return new SVGElementContainer(element);
            }
            if (isLIElement(element)) {
                return new LIElementContainer(element);
            }
            if (isOLElement(element)) {
                return new OLElementContainer(element);
            }
            if (isInputElement(element)) {
                return new InputElementContainer(element);
            }
            if (isSelectElement(element)) {
                return new SelectElementContainer(element);
            }
            if (isTextareaElement(element)) {
                return new TextareaElementContainer(element);
            }
            if (isIFrameElement(element)) {
                return new IFrameElementContainer(element);
            }
            return new ElementContainer(element);
        };
        var parseTree = function (element) {
            var container = createContainer(element);
            container.flags |= 4 /* CREATES_REAL_STACKING_CONTEXT */;
            parseNodeTree(element, container, container);
            return container;
        };
        var createsRealStackingContext = function (node, container, root) {
            return (container.styles.isPositionedWithZIndex() ||
                container.styles.opacity < 1 ||
                container.styles.isTransformed() ||
                (isBodyElement(node) && root.styles.isTransparent()));
        };
        var createsStackingContext = function (styles) { return styles.isPositioned() || styles.isFloating(); };
        var isTextNode = function (node) { return node.nodeType === Node.TEXT_NODE; };
        var isElementNode = function (node) { return node.nodeType === Node.ELEMENT_NODE; };
        var isHTMLElementNode = function (node) {
            return isElementNode(node) && typeof node.style !== 'undefined' && !isSVGElementNode(node);
        };
        var isSVGElementNode = function (element) {
            return typeof element.className === 'object';
        };
        var isLIElement = function (node) { return node.tagName === 'LI'; };
        var isOLElement = function (node) { return node.tagName === 'OL'; };
        var isInputElement = function (node) { return node.tagName === 'INPUT'; };
        var isHTMLElement = function (node) { return node.tagName === 'HTML'; };
        var isSVGElement = function (node) { return node.tagName === 'svg'; };
        var isBodyElement = function (node) { return node.tagName === 'BODY'; };
        var isCanvasElement = function (node) { return node.tagName === 'CANVAS'; };
        var isImageElement = function (node) { return node.tagName === 'IMG'; };
        var isIFrameElement = function (node) { return node.tagName === 'IFRAME'; };
        var isStyleElement = function (node) { return node.tagName === 'STYLE'; };
        var isScriptElement = function (node) { return node.tagName === 'SCRIPT'; };
        var isTextareaElement = function (node) { return node.tagName === 'TEXTAREA'; };
        var isSelectElement = function (node) { return node.tagName === 'SELECT'; };
        var isSlotElement = function (node) { return node.tagName === 'SLOT'; };

        var CounterState = /** @class */ (function () {
            function CounterState() {
                this.counters = {};
            }
            CounterState.prototype.getCounterValue = function (name) {
                var counter = this.counters[name];
                if (counter && counter.length) {
                    return counter[counter.length - 1];
                }
                return 1;
            };
            CounterState.prototype.getCounterValues = function (name) {
                var counter = this.counters[name];
                return counter ? counter : [];
            };
            CounterState.prototype.pop = function (counters) {
                var _this = this;
                counters.forEach(function (counter) { return _this.counters[counter].pop(); });
            };
            CounterState.prototype.parse = function (style) {
                var _this = this;
                var counterIncrement = style.counterIncrement;
                var counterReset = style.counterReset;
                var canReset = true;
                if (counterIncrement !== null) {
                    counterIncrement.forEach(function (entry) {
                        var counter = _this.counters[entry.counter];
                        if (counter && entry.increment !== 0) {
                            canReset = false;
                            counter[Math.max(0, counter.length - 1)] += entry.increment;
                        }
                    });
                }
                var counterNames = [];
                if (canReset) {
                    counterReset.forEach(function (entry) {
                        var counter = _this.counters[entry.counter];
                        counterNames.push(entry.counter);
                        if (!counter) {
                            counter = _this.counters[entry.counter] = [];
                        }
                        counter.push(entry.reset);
                    });
                }
                return counterNames;
            };
            return CounterState;
        }());
        var ROMAN_UPPER = {
            integers: [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1],
            values: ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I']
        };
        var ARMENIAN = {
            integers: [
                9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100, 90, 80, 70,
                60, 50, 40, 30, 20, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
            ],
            values: [
                'Ք',
                'Փ',
                'Ւ',
                'Ց',
                'Ր',
                'Տ',
                'Վ',
                'Ս',
                'Ռ',
                'Ջ',
                'Պ',
                'Չ',
                'Ո',
                'Շ',
                'Ն',
                'Յ',
                'Մ',
                'Ճ',
                'Ղ',
                'Ձ',
                'Հ',
                'Կ',
                'Ծ',
                'Խ',
                'Լ',
                'Ի',
                'Ժ',
                'Թ',
                'Ը',
                'Է',
                'Զ',
                'Ե',
                'Դ',
                'Գ',
                'Բ',
                'Ա'
            ]
        };
        var HEBREW = {
            integers: [
                10000, 9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000, 1000, 400, 300, 200, 100, 90, 80, 70, 60, 50, 40, 30, 20,
                19, 18, 17, 16, 15, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
            ],
            values: [
                'י׳',
                'ט׳',
                'ח׳',
                'ז׳',
                'ו׳',
                'ה׳',
                'ד׳',
                'ג׳',
                'ב׳',
                'א׳',
                'ת',
                'ש',
                'ר',
                'ק',
                'צ',
                'פ',
                'ע',
                'ס',
                'נ',
                'מ',
                'ל',
                'כ',
                'יט',
                'יח',
                'יז',
                'טז',
                'טו',
                'י',
                'ט',
                'ח',
                'ז',
                'ו',
                'ה',
                'ד',
                'ג',
                'ב',
                'א'
            ]
        };
        var GEORGIAN = {
            integers: [
                10000, 9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100, 90,
                80, 70, 60, 50, 40, 30, 20, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
            ],
            values: [
                'ჵ',
                'ჰ',
                'ჯ',
                'ჴ',
                'ხ',
                'ჭ',
                'წ',
                'ძ',
                'ც',
                'ჩ',
                'შ',
                'ყ',
                'ღ',
                'ქ',
                'ფ',
                'ჳ',
                'ტ',
                'ს',
                'რ',
                'ჟ',
                'პ',
                'ო',
                'ჲ',
                'ნ',
                'მ',
                'ლ',
                'კ',
                'ი',
                'თ',
                'ჱ',
                'ზ',
                'ვ',
                'ე',
                'დ',
                'გ',
                'ბ',
                'ა'
            ]
        };
        var createAdditiveCounter = function (value, min, max, symbols, fallback, suffix) {
            if (value < min || value > max) {
                return createCounterText(value, fallback, suffix.length > 0);
            }
            return (symbols.integers.reduce(function (string, integer, index) {
                while (value >= integer) {
                    value -= integer;
                    string += symbols.values[index];
                }
                return string;
            }, '') + suffix);
        };
        var createCounterStyleWithSymbolResolver = function (value, codePointRangeLength, isNumeric, resolver) {
            var string = '';
            do {
                if (!isNumeric) {
                    value--;
                }
                string = resolver(value) + string;
                value /= codePointRangeLength;
            } while (value * codePointRangeLength >= codePointRangeLength);
            return string;
        };
        var createCounterStyleFromRange = function (value, codePointRangeStart, codePointRangeEnd, isNumeric, suffix) {
            var codePointRangeLength = codePointRangeEnd - codePointRangeStart + 1;
            return ((value < 0 ? '-' : '') +
                (createCounterStyleWithSymbolResolver(Math.abs(value), codePointRangeLength, isNumeric, function (codePoint) {
                    return fromCodePoint(Math.floor(codePoint % codePointRangeLength) + codePointRangeStart);
                }) +
                    suffix));
        };
        var createCounterStyleFromSymbols = function (value, symbols, suffix) {
            if (suffix === void 0) { suffix = '. '; }
            var codePointRangeLength = symbols.length;
            return (createCounterStyleWithSymbolResolver(Math.abs(value), codePointRangeLength, false, function (codePoint) { return symbols[Math.floor(codePoint % codePointRangeLength)]; }) + suffix);
        };
        var CJK_ZEROS = 1 << 0;
        var CJK_TEN_COEFFICIENTS = 1 << 1;
        var CJK_TEN_HIGH_COEFFICIENTS = 1 << 2;
        var CJK_HUNDRED_COEFFICIENTS = 1 << 3;
        var createCJKCounter = function (value, numbers, multipliers, negativeSign, suffix, flags) {
            if (value < -9999 || value > 9999) {
                return createCounterText(value, LIST_STYLE_TYPE.CJK_DECIMAL, suffix.length > 0);
            }
            var tmp = Math.abs(value);
            var string = suffix;
            if (tmp === 0) {
                return numbers[0] + string;
            }
            for (var digit = 0; tmp > 0 && digit <= 4; digit++) {
                var coefficient = tmp % 10;
                if (coefficient === 0 && contains(flags, CJK_ZEROS) && string !== '') {
                    string = numbers[coefficient] + string;
                }
                else if (coefficient > 1 ||
                    (coefficient === 1 && digit === 0) ||
                    (coefficient === 1 && digit === 1 && contains(flags, CJK_TEN_COEFFICIENTS)) ||
                    (coefficient === 1 && digit === 1 && contains(flags, CJK_TEN_HIGH_COEFFICIENTS) && value > 100) ||
                    (coefficient === 1 && digit > 1 && contains(flags, CJK_HUNDRED_COEFFICIENTS))) {
                    string = numbers[coefficient] + (digit > 0 ? multipliers[digit - 1] : '') + string;
                }
                else if (coefficient === 1 && digit > 0) {
                    string = multipliers[digit - 1] + string;
                }
                tmp = Math.floor(tmp / 10);
            }
            return (value < 0 ? negativeSign : '') + string;
        };
        var CHINESE_INFORMAL_MULTIPLIERS = '十百千萬';
        var CHINESE_FORMAL_MULTIPLIERS = '拾佰仟萬';
        var JAPANESE_NEGATIVE = 'マイナス';
        var KOREAN_NEGATIVE = '마이너스';
        var createCounterText = function (value, type, appendSuffix) {
            var defaultSuffix = appendSuffix ? '. ' : '';
            var cjkSuffix = appendSuffix ? '、' : '';
            var koreanSuffix = appendSuffix ? ', ' : '';
            var spaceSuffix = appendSuffix ? ' ' : '';
            switch (type) {
                case LIST_STYLE_TYPE.DISC:
                    return '•' + spaceSuffix;
                case LIST_STYLE_TYPE.CIRCLE:
                    return '◦' + spaceSuffix;
                case LIST_STYLE_TYPE.SQUARE:
                    return '◾' + spaceSuffix;
                case LIST_STYLE_TYPE.DECIMAL_LEADING_ZERO:
                    var string = createCounterStyleFromRange(value, 48, 57, true, defaultSuffix);
                    return string.length < 4 ? "0" + string : string;
                case LIST_STYLE_TYPE.CJK_DECIMAL:
                    return createCounterStyleFromSymbols(value, '〇一二三四五六七八九', cjkSuffix);
                case LIST_STYLE_TYPE.LOWER_ROMAN:
                    return createAdditiveCounter(value, 1, 3999, ROMAN_UPPER, LIST_STYLE_TYPE.DECIMAL, defaultSuffix).toLowerCase();
                case LIST_STYLE_TYPE.UPPER_ROMAN:
                    return createAdditiveCounter(value, 1, 3999, ROMAN_UPPER, LIST_STYLE_TYPE.DECIMAL, defaultSuffix);
                case LIST_STYLE_TYPE.LOWER_GREEK:
                    return createCounterStyleFromRange(value, 945, 969, false, defaultSuffix);
                case LIST_STYLE_TYPE.LOWER_ALPHA:
                    return createCounterStyleFromRange(value, 97, 122, false, defaultSuffix);
                case LIST_STYLE_TYPE.UPPER_ALPHA:
                    return createCounterStyleFromRange(value, 65, 90, false, defaultSuffix);
                case LIST_STYLE_TYPE.ARABIC_INDIC:
                    return createCounterStyleFromRange(value, 1632, 1641, true, defaultSuffix);
                case LIST_STYLE_TYPE.ARMENIAN:
                case LIST_STYLE_TYPE.UPPER_ARMENIAN:
                    return createAdditiveCounter(value, 1, 9999, ARMENIAN, LIST_STYLE_TYPE.DECIMAL, defaultSuffix);
                case LIST_STYLE_TYPE.LOWER_ARMENIAN:
                    return createAdditiveCounter(value, 1, 9999, ARMENIAN, LIST_STYLE_TYPE.DECIMAL, defaultSuffix).toLowerCase();
                case LIST_STYLE_TYPE.BENGALI:
                    return createCounterStyleFromRange(value, 2534, 2543, true, defaultSuffix);
                case LIST_STYLE_TYPE.CAMBODIAN:
                case LIST_STYLE_TYPE.KHMER:
                    return createCounterStyleFromRange(value, 6112, 6121, true, defaultSuffix);
                case LIST_STYLE_TYPE.CJK_EARTHLY_BRANCH:
                    return createCounterStyleFromSymbols(value, '子丑寅卯辰巳午未申酉戌亥', cjkSuffix);
                case LIST_STYLE_TYPE.CJK_HEAVENLY_STEM:
                    return createCounterStyleFromSymbols(value, '甲乙丙丁戊己庚辛壬癸', cjkSuffix);
                case LIST_STYLE_TYPE.CJK_IDEOGRAPHIC:
                case LIST_STYLE_TYPE.TRAD_CHINESE_INFORMAL:
                    return createCJKCounter(value, '零一二三四五六七八九', CHINESE_INFORMAL_MULTIPLIERS, '負', cjkSuffix, CJK_TEN_COEFFICIENTS | CJK_TEN_HIGH_COEFFICIENTS | CJK_HUNDRED_COEFFICIENTS);
                case LIST_STYLE_TYPE.TRAD_CHINESE_FORMAL:
                    return createCJKCounter(value, '零壹貳參肆伍陸柒捌玖', CHINESE_FORMAL_MULTIPLIERS, '負', cjkSuffix, CJK_ZEROS | CJK_TEN_COEFFICIENTS | CJK_TEN_HIGH_COEFFICIENTS | CJK_HUNDRED_COEFFICIENTS);
                case LIST_STYLE_TYPE.SIMP_CHINESE_INFORMAL:
                    return createCJKCounter(value, '零一二三四五六七八九', CHINESE_INFORMAL_MULTIPLIERS, '负', cjkSuffix, CJK_TEN_COEFFICIENTS | CJK_TEN_HIGH_COEFFICIENTS | CJK_HUNDRED_COEFFICIENTS);
                case LIST_STYLE_TYPE.SIMP_CHINESE_FORMAL:
                    return createCJKCounter(value, '零壹贰叁肆伍陆柒捌玖', CHINESE_FORMAL_MULTIPLIERS, '负', cjkSuffix, CJK_ZEROS | CJK_TEN_COEFFICIENTS | CJK_TEN_HIGH_COEFFICIENTS | CJK_HUNDRED_COEFFICIENTS);
                case LIST_STYLE_TYPE.JAPANESE_INFORMAL:
                    return createCJKCounter(value, '〇一二三四五六七八九', '十百千万', JAPANESE_NEGATIVE, cjkSuffix, 0);
                case LIST_STYLE_TYPE.JAPANESE_FORMAL:
                    return createCJKCounter(value, '零壱弐参四伍六七八九', '拾百千万', JAPANESE_NEGATIVE, cjkSuffix, CJK_ZEROS | CJK_TEN_COEFFICIENTS | CJK_TEN_HIGH_COEFFICIENTS);
                case LIST_STYLE_TYPE.KOREAN_HANGUL_FORMAL:
                    return createCJKCounter(value, '영일이삼사오육칠팔구', '십백천만', KOREAN_NEGATIVE, koreanSuffix, CJK_ZEROS | CJK_TEN_COEFFICIENTS | CJK_TEN_HIGH_COEFFICIENTS);
                case LIST_STYLE_TYPE.KOREAN_HANJA_INFORMAL:
                    return createCJKCounter(value, '零一二三四五六七八九', '十百千萬', KOREAN_NEGATIVE, koreanSuffix, 0);
                case LIST_STYLE_TYPE.KOREAN_HANJA_FORMAL:
                    return createCJKCounter(value, '零壹貳參四五六七八九', '拾百千', KOREAN_NEGATIVE, koreanSuffix, CJK_ZEROS | CJK_TEN_COEFFICIENTS | CJK_TEN_HIGH_COEFFICIENTS);
                case LIST_STYLE_TYPE.DEVANAGARI:
                    return createCounterStyleFromRange(value, 0x966, 0x96f, true, defaultSuffix);
                case LIST_STYLE_TYPE.GEORGIAN:
                    return createAdditiveCounter(value, 1, 19999, GEORGIAN, LIST_STYLE_TYPE.DECIMAL, defaultSuffix);
                case LIST_STYLE_TYPE.GUJARATI:
                    return createCounterStyleFromRange(value, 0xae6, 0xaef, true, defaultSuffix);
                case LIST_STYLE_TYPE.GURMUKHI:
                    return createCounterStyleFromRange(value, 0xa66, 0xa6f, true, defaultSuffix);
                case LIST_STYLE_TYPE.HEBREW:
                    return createAdditiveCounter(value, 1, 10999, HEBREW, LIST_STYLE_TYPE.DECIMAL, defaultSuffix);
                case LIST_STYLE_TYPE.HIRAGANA:
                    return createCounterStyleFromSymbols(value, 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわゐゑをん');
                case LIST_STYLE_TYPE.HIRAGANA_IROHA:
                    return createCounterStyleFromSymbols(value, 'いろはにほへとちりぬるをわかよたれそつねならむうゐのおくやまけふこえてあさきゆめみしゑひもせす');
                case LIST_STYLE_TYPE.KANNADA:
                    return createCounterStyleFromRange(value, 0xce6, 0xcef, true, defaultSuffix);
                case LIST_STYLE_TYPE.KATAKANA:
                    return createCounterStyleFromSymbols(value, 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヰヱヲン', cjkSuffix);
                case LIST_STYLE_TYPE.KATAKANA_IROHA:
                    return createCounterStyleFromSymbols(value, 'イロハニホヘトチリヌルヲワカヨタレソツネナラムウヰノオクヤマケフコエテアサキユメミシヱヒモセス', cjkSuffix);
                case LIST_STYLE_TYPE.LAO:
                    return createCounterStyleFromRange(value, 0xed0, 0xed9, true, defaultSuffix);
                case LIST_STYLE_TYPE.MONGOLIAN:
                    return createCounterStyleFromRange(value, 0x1810, 0x1819, true, defaultSuffix);
                case LIST_STYLE_TYPE.MYANMAR:
                    return createCounterStyleFromRange(value, 0x1040, 0x1049, true, defaultSuffix);
                case LIST_STYLE_TYPE.ORIYA:
                    return createCounterStyleFromRange(value, 0xb66, 0xb6f, true, defaultSuffix);
                case LIST_STYLE_TYPE.PERSIAN:
                    return createCounterStyleFromRange(value, 0x6f0, 0x6f9, true, defaultSuffix);
                case LIST_STYLE_TYPE.TAMIL:
                    return createCounterStyleFromRange(value, 0xbe6, 0xbef, true, defaultSuffix);
                case LIST_STYLE_TYPE.TELUGU:
                    return createCounterStyleFromRange(value, 0xc66, 0xc6f, true, defaultSuffix);
                case LIST_STYLE_TYPE.THAI:
                    return createCounterStyleFromRange(value, 0xe50, 0xe59, true, defaultSuffix);
                case LIST_STYLE_TYPE.TIBETAN:
                    return createCounterStyleFromRange(value, 0xf20, 0xf29, true, defaultSuffix);
                case LIST_STYLE_TYPE.DECIMAL:
                default:
                    return createCounterStyleFromRange(value, 48, 57, true, defaultSuffix);
            }
        };

        var IGNORE_ATTRIBUTE = 'data-html2canvas-ignore';
        var DocumentCloner = /** @class */ (function () {
            function DocumentCloner(element, options) {
                this.options = options;
                this.scrolledElements = [];
                this.referenceElement = element;
                this.counters = new CounterState();
                this.quoteDepth = 0;
                if (!element.ownerDocument) {
                    throw new Error('Cloned element does not have an owner document');
                }
                this.documentElement = this.cloneNode(element.ownerDocument.documentElement);
            }
            DocumentCloner.prototype.toIFrame = function (ownerDocument, windowSize) {
                var _this = this;
                var iframe = createIFrameContainer(ownerDocument, windowSize);
                if (!iframe.contentWindow) {
                    return Promise.reject("Unable to find iframe window");
                }
                var scrollX = ownerDocument.defaultView.pageXOffset;
                var scrollY = ownerDocument.defaultView.pageYOffset;
                var cloneWindow = iframe.contentWindow;
                var documentClone = cloneWindow.document;
                /* Chrome doesn't detect relative background-images assigned in inline <style> sheets when fetched through getComputedStyle
                 if window url is about:blank, we can assign the url to current by writing onto the document
                 */
                var iframeLoad = iframeLoader(iframe).then(function () { return __awaiter(_this, void 0, void 0, function () {
                    var onclone, referenceElement;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                this.scrolledElements.forEach(restoreNodeScroll);
                                if (cloneWindow) {
                                    cloneWindow.scrollTo(windowSize.left, windowSize.top);
                                    if (/(iPad|iPhone|iPod)/g.test(navigator.userAgent) &&
                                        (cloneWindow.scrollY !== windowSize.top || cloneWindow.scrollX !== windowSize.left)) {
                                        documentClone.documentElement.style.top = -windowSize.top + 'px';
                                        documentClone.documentElement.style.left = -windowSize.left + 'px';
                                        documentClone.documentElement.style.position = 'absolute';
                                    }
                                }
                                onclone = this.options.onclone;
                                referenceElement = this.clonedReferenceElement;
                                if (typeof referenceElement === 'undefined') {
                                    return [2 /*return*/, Promise.reject("Error finding the " + this.referenceElement.nodeName + " in the cloned document")];
                                }
                                if (!(documentClone.fonts && documentClone.fonts.ready)) return [3 /*break*/, 2];
                                return [4 /*yield*/, documentClone.fonts.ready];
                            case 1:
                                _a.sent();
                                _a.label = 2;
                            case 2:
                                if (!/(AppleWebKit)/g.test(navigator.userAgent)) return [3 /*break*/, 4];
                                return [4 /*yield*/, imagesReady(documentClone)];
                            case 3:
                                _a.sent();
                                _a.label = 4;
                            case 4:
                                if (typeof onclone === 'function') {
                                    return [2 /*return*/, Promise.resolve()
                                            .then(function () { return onclone(documentClone, referenceElement); })
                                            .then(function () { return iframe; })];
                                }
                                return [2 /*return*/, iframe];
                        }
                    });
                }); });
                documentClone.open();
                documentClone.write(serializeDoctype(document.doctype) + "<html></html>");
                // Chrome scrolls the parent document for some reason after the write to the cloned window???
                restoreOwnerScroll(this.referenceElement.ownerDocument, scrollX, scrollY);
                documentClone.replaceChild(documentClone.adoptNode(this.documentElement), documentClone.documentElement);
                documentClone.close();
                return iframeLoad;
            };
            DocumentCloner.prototype.createElementClone = function (node) {
                if (isCanvasElement(node)) {
                    return this.createCanvasClone(node);
                }
                if (isStyleElement(node)) {
                    return this.createStyleClone(node);
                }
                var clone = node.cloneNode(false);
                if (isImageElement(clone) && clone.loading === 'lazy') {
                    clone.loading = 'eager';
                }
                return clone;
            };
            DocumentCloner.prototype.createStyleClone = function (node) {
                try {
                    var sheet = node.sheet;
                    if (sheet && sheet.cssRules) {
                        var css = [].slice.call(sheet.cssRules, 0).reduce(function (css, rule) {
                            if (rule && typeof rule.cssText === 'string') {
                                return css + rule.cssText;
                            }
                            return css;
                        }, '');
                        var style = node.cloneNode(false);
                        style.textContent = css;
                        return style;
                    }
                }
                catch (e) {
                    // accessing node.sheet.cssRules throws a DOMException
                    Logger.getInstance(this.options.id).error('Unable to access cssRules property', e);
                    if (e.name !== 'SecurityError') {
                        throw e;
                    }
                }
                return node.cloneNode(false);
            };
            DocumentCloner.prototype.createCanvasClone = function (canvas) {
                if (this.options.inlineImages && canvas.ownerDocument) {
                    var img = canvas.ownerDocument.createElement('img');
                    try {
                        img.src = canvas.toDataURL();
                        return img;
                    }
                    catch (e) {
                        Logger.getInstance(this.options.id).info("Unable to clone canvas contents, canvas is tainted");
                    }
                }
                var clonedCanvas = canvas.cloneNode(false);
                try {
                    clonedCanvas.width = canvas.width;
                    clonedCanvas.height = canvas.height;
                    var ctx = canvas.getContext('2d');
                    var clonedCtx = clonedCanvas.getContext('2d');
                    if (clonedCtx) {
                        if (ctx) {
                            clonedCtx.putImageData(ctx.getImageData(0, 0, canvas.width, canvas.height), 0, 0);
                        }
                        else {
                            clonedCtx.drawImage(canvas, 0, 0);
                        }
                    }
                    return clonedCanvas;
                }
                catch (e) { }
                return clonedCanvas;
            };
            DocumentCloner.prototype.cloneNode = function (node) {
                if (isTextNode(node)) {
                    return document.createTextNode(node.data);
                }
                if (!node.ownerDocument) {
                    return node.cloneNode(false);
                }
                var window = node.ownerDocument.defaultView;
                if (window && isElementNode(node) && (isHTMLElementNode(node) || isSVGElementNode(node))) {
                    var clone = this.createElementClone(node);
                    var style = window.getComputedStyle(node);
                    var styleBefore = window.getComputedStyle(node, ':before');
                    var styleAfter = window.getComputedStyle(node, ':after');
                    if (this.referenceElement === node && isHTMLElementNode(clone)) {
                        this.clonedReferenceElement = clone;
                    }
                    if (isBodyElement(clone)) {
                        createPseudoHideStyles(clone);
                    }
                    var counters = this.counters.parse(new CSSParsedCounterDeclaration(style));
                    var before = this.resolvePseudoContent(node, clone, styleBefore, PseudoElementType.BEFORE);
                    for (var child = node.firstChild; child; child = child.nextSibling) {
                        if (!isElementNode(child) ||
                            (!isScriptElement(child) &&
                                !child.hasAttribute(IGNORE_ATTRIBUTE) &&
                                (typeof this.options.ignoreElements !== 'function' || !this.options.ignoreElements(child)))) {
                            if (!this.options.copyStyles || !isElementNode(child) || !isStyleElement(child)) {
                                clone.appendChild(this.cloneNode(child));
                            }
                        }
                    }
                    if (before) {
                        clone.insertBefore(before, clone.firstChild);
                    }
                    var after = this.resolvePseudoContent(node, clone, styleAfter, PseudoElementType.AFTER);
                    if (after) {
                        clone.appendChild(after);
                    }
                    this.counters.pop(counters);
                    if (style && (this.options.copyStyles || isSVGElementNode(node)) && !isIFrameElement(node)) {
                        copyCSSStyles(style, clone);
                    }
                    if (node.scrollTop !== 0 || node.scrollLeft !== 0) {
                        this.scrolledElements.push([clone, node.scrollLeft, node.scrollTop]);
                    }
                    if ((isTextareaElement(node) || isSelectElement(node)) &&
                        (isTextareaElement(clone) || isSelectElement(clone))) {
                        clone.value = node.value;
                    }
                    return clone;
                }
                return node.cloneNode(false);
            };
            DocumentCloner.prototype.resolvePseudoContent = function (node, clone, style, pseudoElt) {
                var _this = this;
                if (!style) {
                    return;
                }
                var value = style.content;
                var document = clone.ownerDocument;
                if (!document || !value || value === 'none' || value === '-moz-alt-content' || style.display === 'none') {
                    return;
                }
                this.counters.parse(new CSSParsedCounterDeclaration(style));
                var declaration = new CSSParsedPseudoDeclaration(style);
                var anonymousReplacedElement = document.createElement('html2canvaspseudoelement');
                copyCSSStyles(style, anonymousReplacedElement);
                declaration.content.forEach(function (token) {
                    if (token.type === TokenType.STRING_TOKEN) {
                        anonymousReplacedElement.appendChild(document.createTextNode(token.value));
                    }
                    else if (token.type === TokenType.URL_TOKEN) {
                        var img = document.createElement('img');
                        img.src = token.value;
                        img.style.opacity = '1';
                        anonymousReplacedElement.appendChild(img);
                    }
                    else if (token.type === TokenType.FUNCTION) {
                        if (token.name === 'attr') {
                            var attr = token.values.filter(isIdentToken);
                            if (attr.length) {
                                anonymousReplacedElement.appendChild(document.createTextNode(node.getAttribute(attr[0].value) || ''));
                            }
                        }
                        else if (token.name === 'counter') {
                            var _a = token.values.filter(nonFunctionArgSeparator), counter = _a[0], counterStyle = _a[1];
                            if (counter && isIdentToken(counter)) {
                                var counterState = _this.counters.getCounterValue(counter.value);
                                var counterType = counterStyle && isIdentToken(counterStyle)
                                    ? listStyleType.parse(counterStyle.value)
                                    : LIST_STYLE_TYPE.DECIMAL;
                                anonymousReplacedElement.appendChild(document.createTextNode(createCounterText(counterState, counterType, false)));
                            }
                        }
                        else if (token.name === 'counters') {
                            var _b = token.values.filter(nonFunctionArgSeparator), counter = _b[0], delim = _b[1], counterStyle = _b[2];
                            if (counter && isIdentToken(counter)) {
                                var counterStates = _this.counters.getCounterValues(counter.value);
                                var counterType_1 = counterStyle && isIdentToken(counterStyle)
                                    ? listStyleType.parse(counterStyle.value)
                                    : LIST_STYLE_TYPE.DECIMAL;
                                var separator = delim && delim.type === TokenType.STRING_TOKEN ? delim.value : '';
                                var text = counterStates
                                    .map(function (value) { return createCounterText(value, counterType_1, false); })
                                    .join(separator);
                                anonymousReplacedElement.appendChild(document.createTextNode(text));
                            }
                        }
                        else ;
                    }
                    else if (token.type === TokenType.IDENT_TOKEN) {
                        switch (token.value) {
                            case 'open-quote':
                                anonymousReplacedElement.appendChild(document.createTextNode(getQuote(declaration.quotes, _this.quoteDepth++, true)));
                                break;
                            case 'close-quote':
                                anonymousReplacedElement.appendChild(document.createTextNode(getQuote(declaration.quotes, --_this.quoteDepth, false)));
                                break;
                            default:
                                // safari doesn't parse string tokens correctly because of lack of quotes
                                anonymousReplacedElement.appendChild(document.createTextNode(token.value));
                        }
                    }
                });
                anonymousReplacedElement.className = PSEUDO_HIDE_ELEMENT_CLASS_BEFORE + " " + PSEUDO_HIDE_ELEMENT_CLASS_AFTER;
                var newClassName = pseudoElt === PseudoElementType.BEFORE
                    ? " " + PSEUDO_HIDE_ELEMENT_CLASS_BEFORE
                    : " " + PSEUDO_HIDE_ELEMENT_CLASS_AFTER;
                if (isSVGElementNode(clone)) {
                    clone.className.baseValue += newClassName;
                }
                else {
                    clone.className += newClassName;
                }
                return anonymousReplacedElement;
            };
            DocumentCloner.destroy = function (container) {
                if (container.parentNode) {
                    container.parentNode.removeChild(container);
                    return true;
                }
                return false;
            };
            return DocumentCloner;
        }());
        var PseudoElementType;
        (function (PseudoElementType) {
            PseudoElementType[PseudoElementType["BEFORE"] = 0] = "BEFORE";
            PseudoElementType[PseudoElementType["AFTER"] = 1] = "AFTER";
        })(PseudoElementType || (PseudoElementType = {}));
        var createIFrameContainer = function (ownerDocument, bounds) {
            var cloneIframeContainer = ownerDocument.createElement('iframe');
            cloneIframeContainer.className = 'html2canvas-container';
            cloneIframeContainer.style.visibility = 'hidden';
            cloneIframeContainer.style.position = 'fixed';
            cloneIframeContainer.style.left = '-10000px';
            cloneIframeContainer.style.top = '0px';
            cloneIframeContainer.style.border = '0';
            cloneIframeContainer.width = bounds.width.toString();
            cloneIframeContainer.height = bounds.height.toString();
            cloneIframeContainer.scrolling = 'no'; // ios won't scroll without it
            cloneIframeContainer.setAttribute(IGNORE_ATTRIBUTE, 'true');
            ownerDocument.body.appendChild(cloneIframeContainer);
            return cloneIframeContainer;
        };
        var imageReady = function (img) {
            return new Promise(function (resolve) {
                if (img.complete) {
                    resolve();
                    return;
                }
                if (!img.src) {
                    resolve();
                    return;
                }
                img.onload = resolve;
                img.onerror = resolve;
            });
        };
        var imagesReady = function (document) {
            return Promise.all([].slice.call(document.images, 0).map(imageReady));
        };
        var iframeLoader = function (iframe) {
            return new Promise(function (resolve, reject) {
                var cloneWindow = iframe.contentWindow;
                if (!cloneWindow) {
                    return reject("No window assigned for iframe");
                }
                var documentClone = cloneWindow.document;
                cloneWindow.onload = iframe.onload = function () {
                    cloneWindow.onload = iframe.onload = null;
                    var interval = setInterval(function () {
                        if (documentClone.body.childNodes.length > 0 && documentClone.readyState === 'complete') {
                            clearInterval(interval);
                            resolve(iframe);
                        }
                    }, 50);
                };
            });
        };
        var ignoredStyleProperties = [
            'all',
            'd',
            'content' // Safari shows pseudoelements if content is set
        ];
        var copyCSSStyles = function (style, target) {
            // Edge does not provide value for cssText
            for (var i = style.length - 1; i >= 0; i--) {
                var property = style.item(i);
                if (ignoredStyleProperties.indexOf(property) === -1) {
                    target.style.setProperty(property, style.getPropertyValue(property));
                }
            }
            return target;
        };
        var serializeDoctype = function (doctype) {
            var str = '';
            if (doctype) {
                str += '<!DOCTYPE ';
                if (doctype.name) {
                    str += doctype.name;
                }
                if (doctype.internalSubset) {
                    str += doctype.internalSubset;
                }
                if (doctype.publicId) {
                    str += "\"" + doctype.publicId + "\"";
                }
                if (doctype.systemId) {
                    str += "\"" + doctype.systemId + "\"";
                }
                str += '>';
            }
            return str;
        };
        var restoreOwnerScroll = function (ownerDocument, x, y) {
            if (ownerDocument &&
                ownerDocument.defaultView &&
                (x !== ownerDocument.defaultView.pageXOffset || y !== ownerDocument.defaultView.pageYOffset)) {
                ownerDocument.defaultView.scrollTo(x, y);
            }
        };
        var restoreNodeScroll = function (_a) {
            var element = _a[0], x = _a[1], y = _a[2];
            element.scrollLeft = x;
            element.scrollTop = y;
        };
        var PSEUDO_BEFORE = ':before';
        var PSEUDO_AFTER = ':after';
        var PSEUDO_HIDE_ELEMENT_CLASS_BEFORE = '___html2canvas___pseudoelement_before';
        var PSEUDO_HIDE_ELEMENT_CLASS_AFTER = '___html2canvas___pseudoelement_after';
        var PSEUDO_HIDE_ELEMENT_STYLE = "{\n    content: \"\" !important;\n    display: none !important;\n}";
        var createPseudoHideStyles = function (body) {
            createStyles(body, "." + PSEUDO_HIDE_ELEMENT_CLASS_BEFORE + PSEUDO_BEFORE + PSEUDO_HIDE_ELEMENT_STYLE + "\n         ." + PSEUDO_HIDE_ELEMENT_CLASS_AFTER + PSEUDO_AFTER + PSEUDO_HIDE_ELEMENT_STYLE);
        };
        var createStyles = function (body, styles) {
            var document = body.ownerDocument;
            if (document) {
                var style = document.createElement('style');
                style.textContent = styles;
                body.appendChild(style);
            }
        };

        var PathType;
        (function (PathType) {
            PathType[PathType["VECTOR"] = 0] = "VECTOR";
            PathType[PathType["BEZIER_CURVE"] = 1] = "BEZIER_CURVE";
        })(PathType || (PathType = {}));
        var equalPath = function (a, b) {
            if (a.length === b.length) {
                return a.some(function (v, i) { return v === b[i]; });
            }
            return false;
        };
        var transformPath = function (path, deltaX, deltaY, deltaW, deltaH) {
            return path.map(function (point, index) {
                switch (index) {
                    case 0:
                        return point.add(deltaX, deltaY);
                    case 1:
                        return point.add(deltaX + deltaW, deltaY);
                    case 2:
                        return point.add(deltaX + deltaW, deltaY + deltaH);
                    case 3:
                        return point.add(deltaX, deltaY + deltaH);
                }
                return point;
            });
        };

        var Vector = /** @class */ (function () {
            function Vector(x, y) {
                this.type = PathType.VECTOR;
                this.x = x;
                this.y = y;
            }
            Vector.prototype.add = function (deltaX, deltaY) {
                return new Vector(this.x + deltaX, this.y + deltaY);
            };
            return Vector;
        }());

        var lerp = function (a, b, t) {
            return new Vector(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        };
        var BezierCurve = /** @class */ (function () {
            function BezierCurve(start, startControl, endControl, end) {
                this.type = PathType.BEZIER_CURVE;
                this.start = start;
                this.startControl = startControl;
                this.endControl = endControl;
                this.end = end;
            }
            BezierCurve.prototype.subdivide = function (t, firstHalf) {
                var ab = lerp(this.start, this.startControl, t);
                var bc = lerp(this.startControl, this.endControl, t);
                var cd = lerp(this.endControl, this.end, t);
                var abbc = lerp(ab, bc, t);
                var bccd = lerp(bc, cd, t);
                var dest = lerp(abbc, bccd, t);
                return firstHalf ? new BezierCurve(this.start, ab, abbc, dest) : new BezierCurve(dest, bccd, cd, this.end);
            };
            BezierCurve.prototype.add = function (deltaX, deltaY) {
                return new BezierCurve(this.start.add(deltaX, deltaY), this.startControl.add(deltaX, deltaY), this.endControl.add(deltaX, deltaY), this.end.add(deltaX, deltaY));
            };
            BezierCurve.prototype.reverse = function () {
                return new BezierCurve(this.end, this.endControl, this.startControl, this.start);
            };
            return BezierCurve;
        }());
        var isBezierCurve = function (path) { return path.type === PathType.BEZIER_CURVE; };

        var BoundCurves = /** @class */ (function () {
            function BoundCurves(element) {
                var styles = element.styles;
                var bounds = element.bounds;
                var _a = getAbsoluteValueForTuple(styles.borderTopLeftRadius, bounds.width, bounds.height), tlh = _a[0], tlv = _a[1];
                var _b = getAbsoluteValueForTuple(styles.borderTopRightRadius, bounds.width, bounds.height), trh = _b[0], trv = _b[1];
                var _c = getAbsoluteValueForTuple(styles.borderBottomRightRadius, bounds.width, bounds.height), brh = _c[0], brv = _c[1];
                var _d = getAbsoluteValueForTuple(styles.borderBottomLeftRadius, bounds.width, bounds.height), blh = _d[0], blv = _d[1];
                var factors = [];
                factors.push((tlh + trh) / bounds.width);
                factors.push((blh + brh) / bounds.width);
                factors.push((tlv + blv) / bounds.height);
                factors.push((trv + brv) / bounds.height);
                var maxFactor = Math.max.apply(Math, factors);
                if (maxFactor > 1) {
                    tlh /= maxFactor;
                    tlv /= maxFactor;
                    trh /= maxFactor;
                    trv /= maxFactor;
                    brh /= maxFactor;
                    brv /= maxFactor;
                    blh /= maxFactor;
                    blv /= maxFactor;
                }
                var topWidth = bounds.width - trh;
                var rightHeight = bounds.height - brv;
                var bottomWidth = bounds.width - brh;
                var leftHeight = bounds.height - blv;
                var borderTopWidth = styles.borderTopWidth;
                var borderRightWidth = styles.borderRightWidth;
                var borderBottomWidth = styles.borderBottomWidth;
                var borderLeftWidth = styles.borderLeftWidth;
                var paddingTop = getAbsoluteValue(styles.paddingTop, element.bounds.width);
                var paddingRight = getAbsoluteValue(styles.paddingRight, element.bounds.width);
                var paddingBottom = getAbsoluteValue(styles.paddingBottom, element.bounds.width);
                var paddingLeft = getAbsoluteValue(styles.paddingLeft, element.bounds.width);
                this.topLeftBorderDoubleOuterBox =
                    tlh > 0 || tlv > 0
                        ? getCurvePoints(bounds.left + borderLeftWidth / 3, bounds.top + borderTopWidth / 3, tlh - borderLeftWidth / 3, tlv - borderTopWidth / 3, CORNER.TOP_LEFT)
                        : new Vector(bounds.left + borderLeftWidth / 3, bounds.top + borderTopWidth / 3);
                this.topRightBorderDoubleOuterBox =
                    tlh > 0 || tlv > 0
                        ? getCurvePoints(bounds.left + topWidth, bounds.top + borderTopWidth / 3, trh - borderRightWidth / 3, trv - borderTopWidth / 3, CORNER.TOP_RIGHT)
                        : new Vector(bounds.left + bounds.width - borderRightWidth / 3, bounds.top + borderTopWidth / 3);
                this.bottomRightBorderDoubleOuterBox =
                    brh > 0 || brv > 0
                        ? getCurvePoints(bounds.left + bottomWidth, bounds.top + rightHeight, brh - borderRightWidth / 3, brv - borderBottomWidth / 3, CORNER.BOTTOM_RIGHT)
                        : new Vector(bounds.left + bounds.width - borderRightWidth / 3, bounds.top + bounds.height - borderBottomWidth / 3);
                this.bottomLeftBorderDoubleOuterBox =
                    blh > 0 || blv > 0
                        ? getCurvePoints(bounds.left + borderLeftWidth / 3, bounds.top + leftHeight, blh - borderLeftWidth / 3, blv - borderBottomWidth / 3, CORNER.BOTTOM_LEFT)
                        : new Vector(bounds.left + borderLeftWidth / 3, bounds.top + bounds.height - borderBottomWidth / 3);
                this.topLeftBorderDoubleInnerBox =
                    tlh > 0 || tlv > 0
                        ? getCurvePoints(bounds.left + (borderLeftWidth * 2) / 3, bounds.top + (borderTopWidth * 2) / 3, tlh - (borderLeftWidth * 2) / 3, tlv - (borderTopWidth * 2) / 3, CORNER.TOP_LEFT)
                        : new Vector(bounds.left + (borderLeftWidth * 2) / 3, bounds.top + (borderTopWidth * 2) / 3);
                this.topRightBorderDoubleInnerBox =
                    tlh > 0 || tlv > 0
                        ? getCurvePoints(bounds.left + topWidth, bounds.top + (borderTopWidth * 2) / 3, trh - (borderRightWidth * 2) / 3, trv - (borderTopWidth * 2) / 3, CORNER.TOP_RIGHT)
                        : new Vector(bounds.left + bounds.width - (borderRightWidth * 2) / 3, bounds.top + (borderTopWidth * 2) / 3);
                this.bottomRightBorderDoubleInnerBox =
                    brh > 0 || brv > 0
                        ? getCurvePoints(bounds.left + bottomWidth, bounds.top + rightHeight, brh - (borderRightWidth * 2) / 3, brv - (borderBottomWidth * 2) / 3, CORNER.BOTTOM_RIGHT)
                        : new Vector(bounds.left + bounds.width - (borderRightWidth * 2) / 3, bounds.top + bounds.height - (borderBottomWidth * 2) / 3);
                this.bottomLeftBorderDoubleInnerBox =
                    blh > 0 || blv > 0
                        ? getCurvePoints(bounds.left + (borderLeftWidth * 2) / 3, bounds.top + leftHeight, blh - (borderLeftWidth * 2) / 3, blv - (borderBottomWidth * 2) / 3, CORNER.BOTTOM_LEFT)
                        : new Vector(bounds.left + (borderLeftWidth * 2) / 3, bounds.top + bounds.height - (borderBottomWidth * 2) / 3);
                this.topLeftBorderStroke =
                    tlh > 0 || tlv > 0
                        ? getCurvePoints(bounds.left + borderLeftWidth / 2, bounds.top + borderTopWidth / 2, tlh - borderLeftWidth / 2, tlv - borderTopWidth / 2, CORNER.TOP_LEFT)
                        : new Vector(bounds.left + borderLeftWidth / 2, bounds.top + borderTopWidth / 2);
                this.topRightBorderStroke =
                    tlh > 0 || tlv > 0
                        ? getCurvePoints(bounds.left + topWidth, bounds.top + borderTopWidth / 2, trh - borderRightWidth / 2, trv - borderTopWidth / 2, CORNER.TOP_RIGHT)
                        : new Vector(bounds.left + bounds.width - borderRightWidth / 2, bounds.top + borderTopWidth / 2);
                this.bottomRightBorderStroke =
                    brh > 0 || brv > 0
                        ? getCurvePoints(bounds.left + bottomWidth, bounds.top + rightHeight, brh - borderRightWidth / 2, brv - borderBottomWidth / 2, CORNER.BOTTOM_RIGHT)
                        : new Vector(bounds.left + bounds.width - borderRightWidth / 2, bounds.top + bounds.height - borderBottomWidth / 2);
                this.bottomLeftBorderStroke =
                    blh > 0 || blv > 0
                        ? getCurvePoints(bounds.left + borderLeftWidth / 2, bounds.top + leftHeight, blh - borderLeftWidth / 2, blv - borderBottomWidth / 2, CORNER.BOTTOM_LEFT)
                        : new Vector(bounds.left + borderLeftWidth / 2, bounds.top + bounds.height - borderBottomWidth / 2);
                this.topLeftBorderBox =
                    tlh > 0 || tlv > 0
                        ? getCurvePoints(bounds.left, bounds.top, tlh, tlv, CORNER.TOP_LEFT)
                        : new Vector(bounds.left, bounds.top);
                this.topRightBorderBox =
                    trh > 0 || trv > 0
                        ? getCurvePoints(bounds.left + topWidth, bounds.top, trh, trv, CORNER.TOP_RIGHT)
                        : new Vector(bounds.left + bounds.width, bounds.top);
                this.bottomRightBorderBox =
                    brh > 0 || brv > 0
                        ? getCurvePoints(bounds.left + bottomWidth, bounds.top + rightHeight, brh, brv, CORNER.BOTTOM_RIGHT)
                        : new Vector(bounds.left + bounds.width, bounds.top + bounds.height);
                this.bottomLeftBorderBox =
                    blh > 0 || blv > 0
                        ? getCurvePoints(bounds.left, bounds.top + leftHeight, blh, blv, CORNER.BOTTOM_LEFT)
                        : new Vector(bounds.left, bounds.top + bounds.height);
                this.topLeftPaddingBox =
                    tlh > 0 || tlv > 0
                        ? getCurvePoints(bounds.left + borderLeftWidth, bounds.top + borderTopWidth, Math.max(0, tlh - borderLeftWidth), Math.max(0, tlv - borderTopWidth), CORNER.TOP_LEFT)
                        : new Vector(bounds.left + borderLeftWidth, bounds.top + borderTopWidth);
                this.topRightPaddingBox =
                    trh > 0 || trv > 0
                        ? getCurvePoints(bounds.left + Math.min(topWidth, bounds.width - borderRightWidth), bounds.top + borderTopWidth, topWidth > bounds.width + borderRightWidth ? 0 : Math.max(0, trh - borderRightWidth), Math.max(0, trv - borderTopWidth), CORNER.TOP_RIGHT)
                        : new Vector(bounds.left + bounds.width - borderRightWidth, bounds.top + borderTopWidth);
                this.bottomRightPaddingBox =
                    brh > 0 || brv > 0
                        ? getCurvePoints(bounds.left + Math.min(bottomWidth, bounds.width - borderLeftWidth), bounds.top + Math.min(rightHeight, bounds.height - borderBottomWidth), Math.max(0, brh - borderRightWidth), Math.max(0, brv - borderBottomWidth), CORNER.BOTTOM_RIGHT)
                        : new Vector(bounds.left + bounds.width - borderRightWidth, bounds.top + bounds.height - borderBottomWidth);
                this.bottomLeftPaddingBox =
                    blh > 0 || blv > 0
                        ? getCurvePoints(bounds.left + borderLeftWidth, bounds.top + Math.min(leftHeight, bounds.height - borderBottomWidth), Math.max(0, blh - borderLeftWidth), Math.max(0, blv - borderBottomWidth), CORNER.BOTTOM_LEFT)
                        : new Vector(bounds.left + borderLeftWidth, bounds.top + bounds.height - borderBottomWidth);
                this.topLeftContentBox =
                    tlh > 0 || tlv > 0
                        ? getCurvePoints(bounds.left + borderLeftWidth + paddingLeft, bounds.top + borderTopWidth + paddingTop, Math.max(0, tlh - (borderLeftWidth + paddingLeft)), Math.max(0, tlv - (borderTopWidth + paddingTop)), CORNER.TOP_LEFT)
                        : new Vector(bounds.left + borderLeftWidth + paddingLeft, bounds.top + borderTopWidth + paddingTop);
                this.topRightContentBox =
                    trh > 0 || trv > 0
                        ? getCurvePoints(bounds.left + Math.min(topWidth, bounds.width + borderLeftWidth + paddingLeft), bounds.top + borderTopWidth + paddingTop, topWidth > bounds.width + borderLeftWidth + paddingLeft ? 0 : trh - borderLeftWidth + paddingLeft, trv - (borderTopWidth + paddingTop), CORNER.TOP_RIGHT)
                        : new Vector(bounds.left + bounds.width - (borderRightWidth + paddingRight), bounds.top + borderTopWidth + paddingTop);
                this.bottomRightContentBox =
                    brh > 0 || brv > 0
                        ? getCurvePoints(bounds.left + Math.min(bottomWidth, bounds.width - (borderLeftWidth + paddingLeft)), bounds.top + Math.min(rightHeight, bounds.height + borderTopWidth + paddingTop), Math.max(0, brh - (borderRightWidth + paddingRight)), brv - (borderBottomWidth + paddingBottom), CORNER.BOTTOM_RIGHT)
                        : new Vector(bounds.left + bounds.width - (borderRightWidth + paddingRight), bounds.top + bounds.height - (borderBottomWidth + paddingBottom));
                this.bottomLeftContentBox =
                    blh > 0 || blv > 0
                        ? getCurvePoints(bounds.left + borderLeftWidth + paddingLeft, bounds.top + leftHeight, Math.max(0, blh - (borderLeftWidth + paddingLeft)), blv - (borderBottomWidth + paddingBottom), CORNER.BOTTOM_LEFT)
                        : new Vector(bounds.left + borderLeftWidth + paddingLeft, bounds.top + bounds.height - (borderBottomWidth + paddingBottom));
            }
            return BoundCurves;
        }());
        var CORNER;
        (function (CORNER) {
            CORNER[CORNER["TOP_LEFT"] = 0] = "TOP_LEFT";
            CORNER[CORNER["TOP_RIGHT"] = 1] = "TOP_RIGHT";
            CORNER[CORNER["BOTTOM_RIGHT"] = 2] = "BOTTOM_RIGHT";
            CORNER[CORNER["BOTTOM_LEFT"] = 3] = "BOTTOM_LEFT";
        })(CORNER || (CORNER = {}));
        var getCurvePoints = function (x, y, r1, r2, position) {
            var kappa = 4 * ((Math.sqrt(2) - 1) / 3);
            var ox = r1 * kappa; // control point offset horizontal
            var oy = r2 * kappa; // control point offset vertical
            var xm = x + r1; // x-middle
            var ym = y + r2; // y-middle
            switch (position) {
                case CORNER.TOP_LEFT:
                    return new BezierCurve(new Vector(x, ym), new Vector(x, ym - oy), new Vector(xm - ox, y), new Vector(xm, y));
                case CORNER.TOP_RIGHT:
                    return new BezierCurve(new Vector(x, y), new Vector(x + ox, y), new Vector(xm, ym - oy), new Vector(xm, ym));
                case CORNER.BOTTOM_RIGHT:
                    return new BezierCurve(new Vector(xm, y), new Vector(xm, y + oy), new Vector(x + ox, ym), new Vector(x, ym));
                case CORNER.BOTTOM_LEFT:
                default:
                    return new BezierCurve(new Vector(xm, ym), new Vector(xm - ox, ym), new Vector(x, y + oy), new Vector(x, y));
            }
        };
        var calculateBorderBoxPath = function (curves) {
            return [curves.topLeftBorderBox, curves.topRightBorderBox, curves.bottomRightBorderBox, curves.bottomLeftBorderBox];
        };
        var calculateContentBoxPath = function (curves) {
            return [
                curves.topLeftContentBox,
                curves.topRightContentBox,
                curves.bottomRightContentBox,
                curves.bottomLeftContentBox
            ];
        };
        var calculatePaddingBoxPath = function (curves) {
            return [
                curves.topLeftPaddingBox,
                curves.topRightPaddingBox,
                curves.bottomRightPaddingBox,
                curves.bottomLeftPaddingBox
            ];
        };

        var TransformEffect = /** @class */ (function () {
            function TransformEffect(offsetX, offsetY, matrix) {
                this.type = 0 /* TRANSFORM */;
                this.target = 2 /* BACKGROUND_BORDERS */ | 4 /* CONTENT */;
                this.offsetX = offsetX;
                this.offsetY = offsetY;
                this.matrix = matrix;
            }
            return TransformEffect;
        }());
        var ClipEffect = /** @class */ (function () {
            function ClipEffect(path, target) {
                this.type = 1 /* CLIP */;
                this.target = target;
                this.path = path;
            }
            return ClipEffect;
        }());
        var OpacityEffect = /** @class */ (function () {
            function OpacityEffect(opacity) {
                this.type = 2 /* OPACITY */;
                this.target = 2 /* BACKGROUND_BORDERS */ | 4 /* CONTENT */;
                this.opacity = opacity;
            }
            return OpacityEffect;
        }());
        var isTransformEffect = function (effect) {
            return effect.type === 0 /* TRANSFORM */;
        };
        var isClipEffect = function (effect) { return effect.type === 1 /* CLIP */; };
        var isOpacityEffect = function (effect) { return effect.type === 2 /* OPACITY */; };

        var StackingContext = /** @class */ (function () {
            function StackingContext(container) {
                this.element = container;
                this.inlineLevel = [];
                this.nonInlineLevel = [];
                this.negativeZIndex = [];
                this.zeroOrAutoZIndexOrTransformedOrOpacity = [];
                this.positiveZIndex = [];
                this.nonPositionedFloats = [];
                this.nonPositionedInlineLevel = [];
            }
            return StackingContext;
        }());
        var ElementPaint = /** @class */ (function () {
            function ElementPaint(element, parentStack) {
                this.container = element;
                this.effects = parentStack.slice(0);
                this.curves = new BoundCurves(element);
                if (element.styles.opacity < 1) {
                    this.effects.push(new OpacityEffect(element.styles.opacity));
                }
                if (element.styles.transform !== null) {
                    var offsetX = element.bounds.left + element.styles.transformOrigin[0].number;
                    var offsetY = element.bounds.top + element.styles.transformOrigin[1].number;
                    var matrix = element.styles.transform;
                    this.effects.push(new TransformEffect(offsetX, offsetY, matrix));
                }
                if (element.styles.overflowX !== OVERFLOW.VISIBLE) {
                    var borderBox = calculateBorderBoxPath(this.curves);
                    var paddingBox = calculatePaddingBoxPath(this.curves);
                    if (equalPath(borderBox, paddingBox)) {
                        this.effects.push(new ClipEffect(borderBox, 2 /* BACKGROUND_BORDERS */ | 4 /* CONTENT */));
                    }
                    else {
                        this.effects.push(new ClipEffect(borderBox, 2 /* BACKGROUND_BORDERS */));
                        this.effects.push(new ClipEffect(paddingBox, 4 /* CONTENT */));
                    }
                }
            }
            ElementPaint.prototype.getParentEffects = function () {
                var effects = this.effects.slice(0);
                if (this.container.styles.overflowX !== OVERFLOW.VISIBLE) {
                    var borderBox = calculateBorderBoxPath(this.curves);
                    var paddingBox = calculatePaddingBoxPath(this.curves);
                    if (!equalPath(borderBox, paddingBox)) {
                        effects.push(new ClipEffect(paddingBox, 2 /* BACKGROUND_BORDERS */ | 4 /* CONTENT */));
                    }
                }
                return effects;
            };
            return ElementPaint;
        }());
        var parseStackTree = function (parent, stackingContext, realStackingContext, listItems) {
            parent.container.elements.forEach(function (child) {
                var treatAsRealStackingContext = contains(child.flags, 4 /* CREATES_REAL_STACKING_CONTEXT */);
                var createsStackingContext = contains(child.flags, 2 /* CREATES_STACKING_CONTEXT */);
                var paintContainer = new ElementPaint(child, parent.getParentEffects());
                if (contains(child.styles.display, 2048 /* LIST_ITEM */)) {
                    listItems.push(paintContainer);
                }
                var listOwnerItems = contains(child.flags, 8 /* IS_LIST_OWNER */) ? [] : listItems;
                if (treatAsRealStackingContext || createsStackingContext) {
                    var parentStack = treatAsRealStackingContext || child.styles.isPositioned() ? realStackingContext : stackingContext;
                    var stack = new StackingContext(paintContainer);
                    if (child.styles.isPositioned() || child.styles.opacity < 1 || child.styles.isTransformed()) {
                        var order_1 = child.styles.zIndex.order;
                        if (order_1 < 0) {
                            var index_1 = 0;
                            parentStack.negativeZIndex.some(function (current, i) {
                                if (order_1 > current.element.container.styles.zIndex.order) {
                                    index_1 = i;
                                    return false;
                                }
                                else if (index_1 > 0) {
                                    return true;
                                }
                                return false;
                            });
                            parentStack.negativeZIndex.splice(index_1, 0, stack);
                        }
                        else if (order_1 > 0) {
                            var index_2 = 0;
                            parentStack.positiveZIndex.some(function (current, i) {
                                if (order_1 >= current.element.container.styles.zIndex.order) {
                                    index_2 = i + 1;
                                    return false;
                                }
                                else if (index_2 > 0) {
                                    return true;
                                }
                                return false;
                            });
                            parentStack.positiveZIndex.splice(index_2, 0, stack);
                        }
                        else {
                            parentStack.zeroOrAutoZIndexOrTransformedOrOpacity.push(stack);
                        }
                    }
                    else {
                        if (child.styles.isFloating()) {
                            parentStack.nonPositionedFloats.push(stack);
                        }
                        else {
                            parentStack.nonPositionedInlineLevel.push(stack);
                        }
                    }
                    parseStackTree(paintContainer, stack, treatAsRealStackingContext ? stack : realStackingContext, listOwnerItems);
                }
                else {
                    if (child.styles.isInlineLevel()) {
                        stackingContext.inlineLevel.push(paintContainer);
                    }
                    else {
                        stackingContext.nonInlineLevel.push(paintContainer);
                    }
                    parseStackTree(paintContainer, stackingContext, realStackingContext, listOwnerItems);
                }
                if (contains(child.flags, 8 /* IS_LIST_OWNER */)) {
                    processListItems(child, listOwnerItems);
                }
            });
        };
        var processListItems = function (owner, elements) {
            var numbering = owner instanceof OLElementContainer ? owner.start : 1;
            var reversed = owner instanceof OLElementContainer ? owner.reversed : false;
            for (var i = 0; i < elements.length; i++) {
                var item = elements[i];
                if (item.container instanceof LIElementContainer &&
                    typeof item.container.value === 'number' &&
                    item.container.value !== 0) {
                    numbering = item.container.value;
                }
                item.listValue = createCounterText(numbering, item.container.styles.listStyleType, true);
                numbering += reversed ? -1 : 1;
            }
        };
        var parseStackingContexts = function (container) {
            var paintContainer = new ElementPaint(container, []);
            var root = new StackingContext(paintContainer);
            var listItems = [];
            parseStackTree(paintContainer, root, root, listItems);
            processListItems(paintContainer.container, listItems);
            return root;
        };

        var parsePathForBorder = function (curves, borderSide) {
            switch (borderSide) {
                case 0:
                    return createPathFromCurves(curves.topLeftBorderBox, curves.topLeftPaddingBox, curves.topRightBorderBox, curves.topRightPaddingBox);
                case 1:
                    return createPathFromCurves(curves.topRightBorderBox, curves.topRightPaddingBox, curves.bottomRightBorderBox, curves.bottomRightPaddingBox);
                case 2:
                    return createPathFromCurves(curves.bottomRightBorderBox, curves.bottomRightPaddingBox, curves.bottomLeftBorderBox, curves.bottomLeftPaddingBox);
                case 3:
                default:
                    return createPathFromCurves(curves.bottomLeftBorderBox, curves.bottomLeftPaddingBox, curves.topLeftBorderBox, curves.topLeftPaddingBox);
            }
        };
        var parsePathForBorderDoubleOuter = function (curves, borderSide) {
            switch (borderSide) {
                case 0:
                    return createPathFromCurves(curves.topLeftBorderBox, curves.topLeftBorderDoubleOuterBox, curves.topRightBorderBox, curves.topRightBorderDoubleOuterBox);
                case 1:
                    return createPathFromCurves(curves.topRightBorderBox, curves.topRightBorderDoubleOuterBox, curves.bottomRightBorderBox, curves.bottomRightBorderDoubleOuterBox);
                case 2:
                    return createPathFromCurves(curves.bottomRightBorderBox, curves.bottomRightBorderDoubleOuterBox, curves.bottomLeftBorderBox, curves.bottomLeftBorderDoubleOuterBox);
                case 3:
                default:
                    return createPathFromCurves(curves.bottomLeftBorderBox, curves.bottomLeftBorderDoubleOuterBox, curves.topLeftBorderBox, curves.topLeftBorderDoubleOuterBox);
            }
        };
        var parsePathForBorderDoubleInner = function (curves, borderSide) {
            switch (borderSide) {
                case 0:
                    return createPathFromCurves(curves.topLeftBorderDoubleInnerBox, curves.topLeftPaddingBox, curves.topRightBorderDoubleInnerBox, curves.topRightPaddingBox);
                case 1:
                    return createPathFromCurves(curves.topRightBorderDoubleInnerBox, curves.topRightPaddingBox, curves.bottomRightBorderDoubleInnerBox, curves.bottomRightPaddingBox);
                case 2:
                    return createPathFromCurves(curves.bottomRightBorderDoubleInnerBox, curves.bottomRightPaddingBox, curves.bottomLeftBorderDoubleInnerBox, curves.bottomLeftPaddingBox);
                case 3:
                default:
                    return createPathFromCurves(curves.bottomLeftBorderDoubleInnerBox, curves.bottomLeftPaddingBox, curves.topLeftBorderDoubleInnerBox, curves.topLeftPaddingBox);
            }
        };
        var parsePathForBorderStroke = function (curves, borderSide) {
            switch (borderSide) {
                case 0:
                    return createStrokePathFromCurves(curves.topLeftBorderStroke, curves.topRightBorderStroke);
                case 1:
                    return createStrokePathFromCurves(curves.topRightBorderStroke, curves.bottomRightBorderStroke);
                case 2:
                    return createStrokePathFromCurves(curves.bottomRightBorderStroke, curves.bottomLeftBorderStroke);
                case 3:
                default:
                    return createStrokePathFromCurves(curves.bottomLeftBorderStroke, curves.topLeftBorderStroke);
            }
        };
        var createStrokePathFromCurves = function (outer1, outer2) {
            var path = [];
            if (isBezierCurve(outer1)) {
                path.push(outer1.subdivide(0.5, false));
            }
            else {
                path.push(outer1);
            }
            if (isBezierCurve(outer2)) {
                path.push(outer2.subdivide(0.5, true));
            }
            else {
                path.push(outer2);
            }
            return path;
        };
        var createPathFromCurves = function (outer1, inner1, outer2, inner2) {
            var path = [];
            if (isBezierCurve(outer1)) {
                path.push(outer1.subdivide(0.5, false));
            }
            else {
                path.push(outer1);
            }
            if (isBezierCurve(outer2)) {
                path.push(outer2.subdivide(0.5, true));
            }
            else {
                path.push(outer2);
            }
            if (isBezierCurve(inner2)) {
                path.push(inner2.subdivide(0.5, true).reverse());
            }
            else {
                path.push(inner2);
            }
            if (isBezierCurve(inner1)) {
                path.push(inner1.subdivide(0.5, false).reverse());
            }
            else {
                path.push(inner1);
            }
            return path;
        };

        var paddingBox = function (element) {
            var bounds = element.bounds;
            var styles = element.styles;
            return bounds.add(styles.borderLeftWidth, styles.borderTopWidth, -(styles.borderRightWidth + styles.borderLeftWidth), -(styles.borderTopWidth + styles.borderBottomWidth));
        };
        var contentBox = function (element) {
            var styles = element.styles;
            var bounds = element.bounds;
            var paddingLeft = getAbsoluteValue(styles.paddingLeft, bounds.width);
            var paddingRight = getAbsoluteValue(styles.paddingRight, bounds.width);
            var paddingTop = getAbsoluteValue(styles.paddingTop, bounds.width);
            var paddingBottom = getAbsoluteValue(styles.paddingBottom, bounds.width);
            return bounds.add(paddingLeft + styles.borderLeftWidth, paddingTop + styles.borderTopWidth, -(styles.borderRightWidth + styles.borderLeftWidth + paddingLeft + paddingRight), -(styles.borderTopWidth + styles.borderBottomWidth + paddingTop + paddingBottom));
        };

        var calculateBackgroundPositioningArea = function (backgroundOrigin, element) {
            if (backgroundOrigin === 0 /* BORDER_BOX */) {
                return element.bounds;
            }
            if (backgroundOrigin === 2 /* CONTENT_BOX */) {
                return contentBox(element);
            }
            return paddingBox(element);
        };
        var calculateBackgroundPaintingArea = function (backgroundClip, element) {
            if (backgroundClip === BACKGROUND_CLIP.BORDER_BOX) {
                return element.bounds;
            }
            if (backgroundClip === BACKGROUND_CLIP.CONTENT_BOX) {
                return contentBox(element);
            }
            return paddingBox(element);
        };
        var calculateBackgroundRendering = function (container, index, intrinsicSize) {
            var backgroundPositioningArea = calculateBackgroundPositioningArea(getBackgroundValueForIndex(container.styles.backgroundOrigin, index), container);
            var backgroundPaintingArea = calculateBackgroundPaintingArea(getBackgroundValueForIndex(container.styles.backgroundClip, index), container);
            var backgroundImageSize = calculateBackgroundSize(getBackgroundValueForIndex(container.styles.backgroundSize, index), intrinsicSize, backgroundPositioningArea);
            var sizeWidth = backgroundImageSize[0], sizeHeight = backgroundImageSize[1];
            var position = getAbsoluteValueForTuple(getBackgroundValueForIndex(container.styles.backgroundPosition, index), backgroundPositioningArea.width - sizeWidth, backgroundPositioningArea.height - sizeHeight);
            var path = calculateBackgroundRepeatPath(getBackgroundValueForIndex(container.styles.backgroundRepeat, index), position, backgroundImageSize, backgroundPositioningArea, backgroundPaintingArea);
            var offsetX = Math.round(backgroundPositioningArea.left + position[0]);
            var offsetY = Math.round(backgroundPositioningArea.top + position[1]);
            return [path, offsetX, offsetY, sizeWidth, sizeHeight];
        };
        var isAuto = function (token) { return isIdentToken(token) && token.value === BACKGROUND_SIZE.AUTO; };
        var hasIntrinsicValue = function (value) { return typeof value === 'number'; };
        var calculateBackgroundSize = function (size, _a, bounds) {
            var intrinsicWidth = _a[0], intrinsicHeight = _a[1], intrinsicProportion = _a[2];
            var first = size[0], second = size[1];
            if (!first) {
                return [0, 0];
            }
            if (isLengthPercentage(first) && second && isLengthPercentage(second)) {
                return [getAbsoluteValue(first, bounds.width), getAbsoluteValue(second, bounds.height)];
            }
            var hasIntrinsicProportion = hasIntrinsicValue(intrinsicProportion);
            if (isIdentToken(first) && (first.value === BACKGROUND_SIZE.CONTAIN || first.value === BACKGROUND_SIZE.COVER)) {
                if (hasIntrinsicValue(intrinsicProportion)) {
                    var targetRatio = bounds.width / bounds.height;
                    return targetRatio < intrinsicProportion !== (first.value === BACKGROUND_SIZE.COVER)
                        ? [bounds.width, bounds.width / intrinsicProportion]
                        : [bounds.height * intrinsicProportion, bounds.height];
                }
                return [bounds.width, bounds.height];
            }
            var hasIntrinsicWidth = hasIntrinsicValue(intrinsicWidth);
            var hasIntrinsicHeight = hasIntrinsicValue(intrinsicHeight);
            var hasIntrinsicDimensions = hasIntrinsicWidth || hasIntrinsicHeight;
            // If the background-size is auto or auto auto:
            if (isAuto(first) && (!second || isAuto(second))) {
                // If the image has both horizontal and vertical intrinsic dimensions, it's rendered at that size.
                if (hasIntrinsicWidth && hasIntrinsicHeight) {
                    return [intrinsicWidth, intrinsicHeight];
                }
                // If the image has no intrinsic dimensions and has no intrinsic proportions,
                // it's rendered at the size of the background positioning area.
                if (!hasIntrinsicProportion && !hasIntrinsicDimensions) {
                    return [bounds.width, bounds.height];
                }
                // TODO If the image has no intrinsic dimensions but has intrinsic proportions, it's rendered as if contain had been specified instead.
                // If the image has only one intrinsic dimension and has intrinsic proportions, it's rendered at the size corresponding to that one dimension.
                // The other dimension is computed using the specified dimension and the intrinsic proportions.
                if (hasIntrinsicDimensions && hasIntrinsicProportion) {
                    var width_1 = hasIntrinsicWidth
                        ? intrinsicWidth
                        : intrinsicHeight * intrinsicProportion;
                    var height_1 = hasIntrinsicHeight
                        ? intrinsicHeight
                        : intrinsicWidth / intrinsicProportion;
                    return [width_1, height_1];
                }
                // If the image has only one intrinsic dimension but has no intrinsic proportions,
                // it's rendered using the specified dimension and the other dimension of the background positioning area.
                var width_2 = hasIntrinsicWidth ? intrinsicWidth : bounds.width;
                var height_2 = hasIntrinsicHeight ? intrinsicHeight : bounds.height;
                return [width_2, height_2];
            }
            // If the image has intrinsic proportions, it's stretched to the specified dimension.
            // The unspecified dimension is computed using the specified dimension and the intrinsic proportions.
            if (hasIntrinsicProportion) {
                var width_3 = 0;
                var height_3 = 0;
                if (isLengthPercentage(first)) {
                    width_3 = getAbsoluteValue(first, bounds.width);
                }
                else if (isLengthPercentage(second)) {
                    height_3 = getAbsoluteValue(second, bounds.height);
                }
                if (isAuto(first)) {
                    width_3 = height_3 * intrinsicProportion;
                }
                else if (!second || isAuto(second)) {
                    height_3 = width_3 / intrinsicProportion;
                }
                return [width_3, height_3];
            }
            // If the image has no intrinsic proportions, it's stretched to the specified dimension.
            // The unspecified dimension is computed using the image's corresponding intrinsic dimension,
            // if there is one. If there is no such intrinsic dimension,
            // it becomes the corresponding dimension of the background positioning area.
            var width = null;
            var height = null;
            if (isLengthPercentage(first)) {
                width = getAbsoluteValue(first, bounds.width);
            }
            else if (second && isLengthPercentage(second)) {
                height = getAbsoluteValue(second, bounds.height);
            }
            if (width !== null && (!second || isAuto(second))) {
                height =
                    hasIntrinsicWidth && hasIntrinsicHeight
                        ? (width / intrinsicWidth) * intrinsicHeight
                        : bounds.height;
            }
            if (height !== null && isAuto(first)) {
                width =
                    hasIntrinsicWidth && hasIntrinsicHeight
                        ? (height / intrinsicHeight) * intrinsicWidth
                        : bounds.width;
            }
            if (width !== null && height !== null) {
                return [width, height];
            }
            throw new Error("Unable to calculate background-size for element");
        };
        var getBackgroundValueForIndex = function (values, index) {
            var value = values[index];
            if (typeof value === 'undefined') {
                return values[0];
            }
            return value;
        };
        var calculateBackgroundRepeatPath = function (repeat, _a, _b, backgroundPositioningArea, backgroundPaintingArea) {
            var x = _a[0], y = _a[1];
            var width = _b[0], height = _b[1];
            switch (repeat) {
                case BACKGROUND_REPEAT.REPEAT_X:
                    return [
                        new Vector(Math.round(backgroundPositioningArea.left), Math.round(backgroundPositioningArea.top + y)),
                        new Vector(Math.round(backgroundPositioningArea.left + backgroundPositioningArea.width), Math.round(backgroundPositioningArea.top + y)),
                        new Vector(Math.round(backgroundPositioningArea.left + backgroundPositioningArea.width), Math.round(height + backgroundPositioningArea.top + y)),
                        new Vector(Math.round(backgroundPositioningArea.left), Math.round(height + backgroundPositioningArea.top + y))
                    ];
                case BACKGROUND_REPEAT.REPEAT_Y:
                    return [
                        new Vector(Math.round(backgroundPositioningArea.left + x), Math.round(backgroundPositioningArea.top)),
                        new Vector(Math.round(backgroundPositioningArea.left + x + width), Math.round(backgroundPositioningArea.top)),
                        new Vector(Math.round(backgroundPositioningArea.left + x + width), Math.round(backgroundPositioningArea.height + backgroundPositioningArea.top)),
                        new Vector(Math.round(backgroundPositioningArea.left + x), Math.round(backgroundPositioningArea.height + backgroundPositioningArea.top))
                    ];
                case BACKGROUND_REPEAT.NO_REPEAT:
                    return [
                        new Vector(Math.round(backgroundPositioningArea.left + x), Math.round(backgroundPositioningArea.top + y)),
                        new Vector(Math.round(backgroundPositioningArea.left + x + width), Math.round(backgroundPositioningArea.top + y)),
                        new Vector(Math.round(backgroundPositioningArea.left + x + width), Math.round(backgroundPositioningArea.top + y + height)),
                        new Vector(Math.round(backgroundPositioningArea.left + x), Math.round(backgroundPositioningArea.top + y + height))
                    ];
                default:
                    return [
                        new Vector(Math.round(backgroundPaintingArea.left), Math.round(backgroundPaintingArea.top)),
                        new Vector(Math.round(backgroundPaintingArea.left + backgroundPaintingArea.width), Math.round(backgroundPaintingArea.top)),
                        new Vector(Math.round(backgroundPaintingArea.left + backgroundPaintingArea.width), Math.round(backgroundPaintingArea.height + backgroundPaintingArea.top)),
                        new Vector(Math.round(backgroundPaintingArea.left), Math.round(backgroundPaintingArea.height + backgroundPaintingArea.top))
                    ];
            }
        };

        var SMALL_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

        var SAMPLE_TEXT = 'Hidden Text';
        var FontMetrics = /** @class */ (function () {
            function FontMetrics(document) {
                this._data = {};
                this._document = document;
            }
            FontMetrics.prototype.parseMetrics = function (fontFamily, fontSize) {
                var container = this._document.createElement('div');
                var img = this._document.createElement('img');
                var span = this._document.createElement('span');
                var body = this._document.body;
                container.style.visibility = 'hidden';
                container.style.fontFamily = fontFamily;
                container.style.fontSize = fontSize;
                container.style.margin = '0';
                container.style.padding = '0';
                body.appendChild(container);
                img.src = SMALL_IMAGE;
                img.width = 1;
                img.height = 1;
                img.style.margin = '0';
                img.style.padding = '0';
                img.style.verticalAlign = 'baseline';
                span.style.fontFamily = fontFamily;
                span.style.fontSize = fontSize;
                span.style.margin = '0';
                span.style.padding = '0';
                span.appendChild(this._document.createTextNode(SAMPLE_TEXT));
                container.appendChild(span);
                container.appendChild(img);
                var baseline = img.offsetTop - span.offsetTop + 2;
                container.removeChild(span);
                container.appendChild(this._document.createTextNode(SAMPLE_TEXT));
                container.style.lineHeight = 'normal';
                img.style.verticalAlign = 'super';
                var middle = img.offsetTop - container.offsetTop + 2;
                body.removeChild(container);
                return { baseline: baseline, middle: middle };
            };
            FontMetrics.prototype.getMetrics = function (fontFamily, fontSize) {
                var key = fontFamily + " " + fontSize;
                if (typeof this._data[key] === 'undefined') {
                    this._data[key] = this.parseMetrics(fontFamily, fontSize);
                }
                return this._data[key];
            };
            return FontMetrics;
        }());

        var MASK_OFFSET = 10000;
        var CanvasRenderer = /** @class */ (function () {
            function CanvasRenderer(options) {
                this._activeEffects = [];
                this.canvas = options.canvas ? options.canvas : document.createElement('canvas');
                this.ctx = this.canvas.getContext('2d');
                this.options = options;
                if (!options.canvas) {
                    this.canvas.width = Math.floor(options.width * options.scale);
                    this.canvas.height = Math.floor(options.height * options.scale);
                    this.canvas.style.width = options.width + "px";
                    this.canvas.style.height = options.height + "px";
                }
                this.fontMetrics = new FontMetrics(document);
                this.ctx.scale(this.options.scale, this.options.scale);
                this.ctx.translate(-options.x + options.scrollX, -options.y + options.scrollY);
                this.ctx.textBaseline = 'bottom';
                this._activeEffects = [];
                Logger.getInstance(options.id).debug("Canvas renderer initialized (" + options.width + "x" + options.height + " at " + options.x + "," + options.y + ") with scale " + options.scale);
            }
            CanvasRenderer.prototype.applyEffects = function (effects, target) {
                var _this = this;
                while (this._activeEffects.length) {
                    this.popEffect();
                }
                effects.filter(function (effect) { return contains(effect.target, target); }).forEach(function (effect) { return _this.applyEffect(effect); });
            };
            CanvasRenderer.prototype.applyEffect = function (effect) {
                this.ctx.save();
                if (isOpacityEffect(effect)) {
                    this.ctx.globalAlpha = effect.opacity;
                }
                if (isTransformEffect(effect)) {
                    this.ctx.translate(effect.offsetX, effect.offsetY);
                    this.ctx.transform(effect.matrix[0], effect.matrix[1], effect.matrix[2], effect.matrix[3], effect.matrix[4], effect.matrix[5]);
                    this.ctx.translate(-effect.offsetX, -effect.offsetY);
                }
                if (isClipEffect(effect)) {
                    this.path(effect.path);
                    this.ctx.clip();
                }
                this._activeEffects.push(effect);
            };
            CanvasRenderer.prototype.popEffect = function () {
                this._activeEffects.pop();
                this.ctx.restore();
            };
            CanvasRenderer.prototype.renderStack = function (stack) {
                return __awaiter(this, void 0, void 0, function () {
                    var styles;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                styles = stack.element.container.styles;
                                if (!styles.isVisible()) return [3 /*break*/, 2];
                                return [4 /*yield*/, this.renderStackContent(stack)];
                            case 1:
                                _a.sent();
                                _a.label = 2;
                            case 2: return [2 /*return*/];
                        }
                    });
                });
            };
            CanvasRenderer.prototype.renderNode = function (paint) {
                return __awaiter(this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (!paint.container.styles.isVisible()) return [3 /*break*/, 3];
                                return [4 /*yield*/, this.renderNodeBackgroundAndBorders(paint)];
                            case 1:
                                _a.sent();
                                return [4 /*yield*/, this.renderNodeContent(paint)];
                            case 2:
                                _a.sent();
                                _a.label = 3;
                            case 3: return [2 /*return*/];
                        }
                    });
                });
            };
            CanvasRenderer.prototype.renderTextWithLetterSpacing = function (text, letterSpacing, baseline) {
                var _this = this;
                if (letterSpacing === 0) {
                    this.ctx.fillText(text.text, text.bounds.left, text.bounds.top + baseline);
                }
                else {
                    var letters = toCodePoints(text.text).map(function (i) { return fromCodePoint(i); });
                    letters.reduce(function (left, letter) {
                        _this.ctx.fillText(letter, left, text.bounds.top + baseline);
                        return left + _this.ctx.measureText(letter).width;
                    }, text.bounds.left);
                }
            };
            CanvasRenderer.prototype.createFontStyle = function (styles) {
                var fontVariant = styles.fontVariant
                    .filter(function (variant) { return variant === 'normal' || variant === 'small-caps'; })
                    .join('');
                var fontFamily = styles.fontFamily.join(', ');
                var fontSize = isDimensionToken(styles.fontSize)
                    ? "" + styles.fontSize.number + styles.fontSize.unit
                    : styles.fontSize.number + "px";
                return [
                    [styles.fontStyle, fontVariant, styles.fontWeight, fontSize, fontFamily].join(' '),
                    fontFamily,
                    fontSize
                ];
            };
            CanvasRenderer.prototype.renderTextNode = function (text, styles) {
                return __awaiter(this, void 0, void 0, function () {
                    var _a, font, fontFamily, fontSize, _b, baseline, middle, paintOrder;
                    var _this = this;
                    return __generator(this, function (_c) {
                        _a = this.createFontStyle(styles), font = _a[0], fontFamily = _a[1], fontSize = _a[2];
                        this.ctx.font = font;
                        this.ctx.textBaseline = 'alphabetic';
                        _b = this.fontMetrics.getMetrics(fontFamily, fontSize), baseline = _b.baseline, middle = _b.middle;
                        paintOrder = styles.paintOrder;
                        text.textBounds.forEach(function (text) {
                            paintOrder.forEach(function (paintOrderLayer) {
                                switch (paintOrderLayer) {
                                    case PAINT_ORDER_LAYER.FILL:
                                        _this.ctx.fillStyle = asString(styles.color);
                                        _this.renderTextWithLetterSpacing(text, styles.letterSpacing, baseline);
                                        var textShadows = styles.textShadow;
                                        if (textShadows.length && text.text.trim().length) {
                                            textShadows
                                                .slice(0)
                                                .reverse()
                                                .forEach(function (textShadow) {
                                                _this.ctx.shadowColor = asString(textShadow.color);
                                                _this.ctx.shadowOffsetX = textShadow.offsetX.number * _this.options.scale;
                                                _this.ctx.shadowOffsetY = textShadow.offsetY.number * _this.options.scale;
                                                _this.ctx.shadowBlur = textShadow.blur.number;
                                                _this.renderTextWithLetterSpacing(text, styles.letterSpacing, baseline);
                                            });
                                            _this.ctx.shadowColor = '';
                                            _this.ctx.shadowOffsetX = 0;
                                            _this.ctx.shadowOffsetY = 0;
                                            _this.ctx.shadowBlur = 0;
                                        }
                                        if (styles.textDecorationLine.length) {
                                            _this.ctx.fillStyle = asString(styles.textDecorationColor || styles.color);
                                            styles.textDecorationLine.forEach(function (textDecorationLine) {
                                                switch (textDecorationLine) {
                                                    case 1 /* UNDERLINE */:
                                                        // Draws a line at the baseline of the font
                                                        // TODO As some browsers display the line as more than 1px if the font-size is big,
                                                        // need to take that into account both in position and size
                                                        _this.ctx.fillRect(text.bounds.left, Math.round(text.bounds.top + baseline), text.bounds.width, 1);
                                                        break;
                                                    case 2 /* OVERLINE */:
                                                        _this.ctx.fillRect(text.bounds.left, Math.round(text.bounds.top), text.bounds.width, 1);
                                                        break;
                                                    case 3 /* LINE_THROUGH */:
                                                        // TODO try and find exact position for line-through
                                                        _this.ctx.fillRect(text.bounds.left, Math.ceil(text.bounds.top + middle), text.bounds.width, 1);
                                                        break;
                                                }
                                            });
                                        }
                                        break;
                                    case PAINT_ORDER_LAYER.STROKE:
                                        if (styles.webkitTextStrokeWidth && text.text.trim().length) {
                                            _this.ctx.strokeStyle = asString(styles.webkitTextStrokeColor);
                                            _this.ctx.lineWidth = styles.webkitTextStrokeWidth;
                                            _this.ctx.lineJoin = !!window.chrome ? 'miter' : 'round';
                                            _this.ctx.strokeText(text.text, text.bounds.left, text.bounds.top + baseline);
                                        }
                                        _this.ctx.strokeStyle = '';
                                        _this.ctx.lineWidth = 0;
                                        _this.ctx.lineJoin = 'miter';
                                        break;
                                }
                            });
                        });
                        return [2 /*return*/];
                    });
                });
            };
            CanvasRenderer.prototype.renderReplacedElement = function (container, curves, image) {
                if (image && container.intrinsicWidth > 0 && container.intrinsicHeight > 0) {
                    var box = contentBox(container);
                    var path = calculatePaddingBoxPath(curves);
                    this.path(path);
                    this.ctx.save();
                    this.ctx.clip();
                    this.ctx.drawImage(image, 0, 0, container.intrinsicWidth, container.intrinsicHeight, box.left, box.top, box.width, box.height);
                    this.ctx.restore();
                }
            };
            CanvasRenderer.prototype.renderNodeContent = function (paint) {
                return __awaiter(this, void 0, void 0, function () {
                    var container, curves, styles, _i, _a, child, image, image, iframeRenderer, canvas, size, _b, fontFamily, fontSize, baseline, bounds, x, textBounds, img, image, url, fontFamily, bounds;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                this.applyEffects(paint.effects, 4 /* CONTENT */);
                                container = paint.container;
                                curves = paint.curves;
                                styles = container.styles;
                                _i = 0, _a = container.textNodes;
                                _c.label = 1;
                            case 1:
                                if (!(_i < _a.length)) return [3 /*break*/, 4];
                                child = _a[_i];
                                return [4 /*yield*/, this.renderTextNode(child, styles)];
                            case 2:
                                _c.sent();
                                _c.label = 3;
                            case 3:
                                _i++;
                                return [3 /*break*/, 1];
                            case 4:
                                if (!(container instanceof ImageElementContainer)) return [3 /*break*/, 8];
                                _c.label = 5;
                            case 5:
                                _c.trys.push([5, 7, , 8]);
                                return [4 /*yield*/, this.options.cache.match(container.src)];
                            case 6:
                                image = _c.sent();
                                this.renderReplacedElement(container, curves, image);
                                return [3 /*break*/, 8];
                            case 7:
                                _c.sent();
                                Logger.getInstance(this.options.id).error("Error loading image " + container.src);
                                return [3 /*break*/, 8];
                            case 8:
                                if (container instanceof CanvasElementContainer) {
                                    this.renderReplacedElement(container, curves, container.canvas);
                                }
                                if (!(container instanceof SVGElementContainer)) return [3 /*break*/, 12];
                                _c.label = 9;
                            case 9:
                                _c.trys.push([9, 11, , 12]);
                                return [4 /*yield*/, this.options.cache.match(container.svg)];
                            case 10:
                                image = _c.sent();
                                this.renderReplacedElement(container, curves, image);
                                return [3 /*break*/, 12];
                            case 11:
                                _c.sent();
                                Logger.getInstance(this.options.id).error("Error loading svg " + container.svg.substring(0, 255));
                                return [3 /*break*/, 12];
                            case 12:
                                if (!(container instanceof IFrameElementContainer && container.tree)) return [3 /*break*/, 14];
                                iframeRenderer = new CanvasRenderer({
                                    id: this.options.id,
                                    scale: this.options.scale,
                                    backgroundColor: container.backgroundColor,
                                    x: 0,
                                    y: 0,
                                    scrollX: 0,
                                    scrollY: 0,
                                    width: container.width,
                                    height: container.height,
                                    cache: this.options.cache,
                                    windowWidth: container.width,
                                    windowHeight: container.height
                                });
                                return [4 /*yield*/, iframeRenderer.render(container.tree)];
                            case 13:
                                canvas = _c.sent();
                                if (container.width && container.height) {
                                    this.ctx.drawImage(canvas, 0, 0, container.width, container.height, container.bounds.left, container.bounds.top, container.bounds.width, container.bounds.height);
                                }
                                _c.label = 14;
                            case 14:
                                if (container instanceof InputElementContainer) {
                                    size = Math.min(container.bounds.width, container.bounds.height);
                                    if (container.type === CHECKBOX) {
                                        if (container.checked) {
                                            this.ctx.save();
                                            this.path([
                                                new Vector(container.bounds.left + size * 0.39363, container.bounds.top + size * 0.79),
                                                new Vector(container.bounds.left + size * 0.16, container.bounds.top + size * 0.5549),
                                                new Vector(container.bounds.left + size * 0.27347, container.bounds.top + size * 0.44071),
                                                new Vector(container.bounds.left + size * 0.39694, container.bounds.top + size * 0.5649),
                                                new Vector(container.bounds.left + size * 0.72983, container.bounds.top + size * 0.23),
                                                new Vector(container.bounds.left + size * 0.84, container.bounds.top + size * 0.34085),
                                                new Vector(container.bounds.left + size * 0.39363, container.bounds.top + size * 0.79)
                                            ]);
                                            this.ctx.fillStyle = asString(INPUT_COLOR);
                                            this.ctx.fill();
                                            this.ctx.restore();
                                        }
                                    }
                                    else if (container.type === RADIO) {
                                        if (container.checked) {
                                            this.ctx.save();
                                            this.ctx.beginPath();
                                            this.ctx.arc(container.bounds.left + size / 2, container.bounds.top + size / 2, size / 4, 0, Math.PI * 2, true);
                                            this.ctx.fillStyle = asString(INPUT_COLOR);
                                            this.ctx.fill();
                                            this.ctx.restore();
                                        }
                                    }
                                }
                                if (isTextInputElement(container) && container.value.length) {
                                    _b = this.createFontStyle(styles), fontFamily = _b[0], fontSize = _b[1];
                                    baseline = this.fontMetrics.getMetrics(fontFamily, fontSize).baseline;
                                    this.ctx.font = fontFamily;
                                    this.ctx.fillStyle = asString(styles.color);
                                    this.ctx.textBaseline = 'alphabetic';
                                    this.ctx.textAlign = canvasTextAlign(container.styles.textAlign);
                                    bounds = contentBox(container);
                                    x = 0;
                                    switch (container.styles.textAlign) {
                                        case TEXT_ALIGN.CENTER:
                                            x += bounds.width / 2;
                                            break;
                                        case TEXT_ALIGN.RIGHT:
                                            x += bounds.width;
                                            break;
                                    }
                                    textBounds = bounds.add(x, 0, 0, -bounds.height / 2 + 1);
                                    this.ctx.save();
                                    this.path([
                                        new Vector(bounds.left, bounds.top),
                                        new Vector(bounds.left + bounds.width, bounds.top),
                                        new Vector(bounds.left + bounds.width, bounds.top + bounds.height),
                                        new Vector(bounds.left, bounds.top + bounds.height)
                                    ]);
                                    this.ctx.clip();
                                    this.renderTextWithLetterSpacing(new TextBounds(container.value, textBounds), styles.letterSpacing, baseline);
                                    this.ctx.restore();
                                    this.ctx.textBaseline = 'alphabetic';
                                    this.ctx.textAlign = 'left';
                                }
                                if (!contains(container.styles.display, 2048 /* LIST_ITEM */)) return [3 /*break*/, 20];
                                if (!(container.styles.listStyleImage !== null)) return [3 /*break*/, 19];
                                img = container.styles.listStyleImage;
                                if (!(img.type === CSSImageType.URL)) return [3 /*break*/, 18];
                                image = void 0;
                                url = img.url;
                                _c.label = 15;
                            case 15:
                                _c.trys.push([15, 17, , 18]);
                                return [4 /*yield*/, this.options.cache.match(url)];
                            case 16:
                                image = _c.sent();
                                this.ctx.drawImage(image, container.bounds.left - (image.width + 10), container.bounds.top);
                                return [3 /*break*/, 18];
                            case 17:
                                _c.sent();
                                Logger.getInstance(this.options.id).error("Error loading list-style-image " + url);
                                return [3 /*break*/, 18];
                            case 18: return [3 /*break*/, 20];
                            case 19:
                                if (paint.listValue && container.styles.listStyleType !== LIST_STYLE_TYPE.NONE) {
                                    fontFamily = this.createFontStyle(styles)[0];
                                    this.ctx.font = fontFamily;
                                    this.ctx.fillStyle = asString(styles.color);
                                    this.ctx.textBaseline = 'middle';
                                    this.ctx.textAlign = 'right';
                                    bounds = new Bounds(container.bounds.left, container.bounds.top + getAbsoluteValue(container.styles.paddingTop, container.bounds.width), container.bounds.width, computeLineHeight(styles.lineHeight, styles.fontSize.number) / 2 + 1);
                                    this.renderTextWithLetterSpacing(new TextBounds(paint.listValue, bounds), styles.letterSpacing, computeLineHeight(styles.lineHeight, styles.fontSize.number) / 2 + 2);
                                    this.ctx.textBaseline = 'bottom';
                                    this.ctx.textAlign = 'left';
                                }
                                _c.label = 20;
                            case 20: return [2 /*return*/];
                        }
                    });
                });
            };
            CanvasRenderer.prototype.renderStackContent = function (stack) {
                return __awaiter(this, void 0, void 0, function () {
                    var _i, _a, child, _b, _c, child, _d, _e, child, _f, _g, child, _h, _j, child, _k, _l, child, _m, _o, child;
                    return __generator(this, function (_p) {
                        switch (_p.label) {
                            case 0: 
                            // https://www.w3.org/TR/css-position-3/#painting-order
                            // 1. the background and borders of the element forming the stacking context.
                            return [4 /*yield*/, this.renderNodeBackgroundAndBorders(stack.element)];
                            case 1:
                                // https://www.w3.org/TR/css-position-3/#painting-order
                                // 1. the background and borders of the element forming the stacking context.
                                _p.sent();
                                _i = 0, _a = stack.negativeZIndex;
                                _p.label = 2;
                            case 2:
                                if (!(_i < _a.length)) return [3 /*break*/, 5];
                                child = _a[_i];
                                return [4 /*yield*/, this.renderStack(child)];
                            case 3:
                                _p.sent();
                                _p.label = 4;
                            case 4:
                                _i++;
                                return [3 /*break*/, 2];
                            case 5: 
                            // 3. For all its in-flow, non-positioned, block-level descendants in tree order:
                            return [4 /*yield*/, this.renderNodeContent(stack.element)];
                            case 6:
                                // 3. For all its in-flow, non-positioned, block-level descendants in tree order:
                                _p.sent();
                                _b = 0, _c = stack.nonInlineLevel;
                                _p.label = 7;
                            case 7:
                                if (!(_b < _c.length)) return [3 /*break*/, 10];
                                child = _c[_b];
                                return [4 /*yield*/, this.renderNode(child)];
                            case 8:
                                _p.sent();
                                _p.label = 9;
                            case 9:
                                _b++;
                                return [3 /*break*/, 7];
                            case 10:
                                _d = 0, _e = stack.nonPositionedFloats;
                                _p.label = 11;
                            case 11:
                                if (!(_d < _e.length)) return [3 /*break*/, 14];
                                child = _e[_d];
                                return [4 /*yield*/, this.renderStack(child)];
                            case 12:
                                _p.sent();
                                _p.label = 13;
                            case 13:
                                _d++;
                                return [3 /*break*/, 11];
                            case 14:
                                _f = 0, _g = stack.nonPositionedInlineLevel;
                                _p.label = 15;
                            case 15:
                                if (!(_f < _g.length)) return [3 /*break*/, 18];
                                child = _g[_f];
                                return [4 /*yield*/, this.renderStack(child)];
                            case 16:
                                _p.sent();
                                _p.label = 17;
                            case 17:
                                _f++;
                                return [3 /*break*/, 15];
                            case 18:
                                _h = 0, _j = stack.inlineLevel;
                                _p.label = 19;
                            case 19:
                                if (!(_h < _j.length)) return [3 /*break*/, 22];
                                child = _j[_h];
                                return [4 /*yield*/, this.renderNode(child)];
                            case 20:
                                _p.sent();
                                _p.label = 21;
                            case 21:
                                _h++;
                                return [3 /*break*/, 19];
                            case 22:
                                _k = 0, _l = stack.zeroOrAutoZIndexOrTransformedOrOpacity;
                                _p.label = 23;
                            case 23:
                                if (!(_k < _l.length)) return [3 /*break*/, 26];
                                child = _l[_k];
                                return [4 /*yield*/, this.renderStack(child)];
                            case 24:
                                _p.sent();
                                _p.label = 25;
                            case 25:
                                _k++;
                                return [3 /*break*/, 23];
                            case 26:
                                _m = 0, _o = stack.positiveZIndex;
                                _p.label = 27;
                            case 27:
                                if (!(_m < _o.length)) return [3 /*break*/, 30];
                                child = _o[_m];
                                return [4 /*yield*/, this.renderStack(child)];
                            case 28:
                                _p.sent();
                                _p.label = 29;
                            case 29:
                                _m++;
                                return [3 /*break*/, 27];
                            case 30: return [2 /*return*/];
                        }
                    });
                });
            };
            CanvasRenderer.prototype.mask = function (paths) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, 0);
                this.ctx.lineTo(this.canvas.width, 0);
                this.ctx.lineTo(this.canvas.width, this.canvas.height);
                this.ctx.lineTo(0, this.canvas.height);
                this.ctx.lineTo(0, 0);
                this.formatPath(paths.slice(0).reverse());
                this.ctx.closePath();
            };
            CanvasRenderer.prototype.path = function (paths) {
                this.ctx.beginPath();
                this.formatPath(paths);
                this.ctx.closePath();
            };
            CanvasRenderer.prototype.formatPath = function (paths) {
                var _this = this;
                paths.forEach(function (point, index) {
                    var start = isBezierCurve(point) ? point.start : point;
                    if (index === 0) {
                        _this.ctx.moveTo(start.x, start.y);
                    }
                    else {
                        _this.ctx.lineTo(start.x, start.y);
                    }
                    if (isBezierCurve(point)) {
                        _this.ctx.bezierCurveTo(point.startControl.x, point.startControl.y, point.endControl.x, point.endControl.y, point.end.x, point.end.y);
                    }
                });
            };
            CanvasRenderer.prototype.renderRepeat = function (path, pattern, offsetX, offsetY) {
                this.path(path);
                this.ctx.fillStyle = pattern;
                this.ctx.translate(offsetX, offsetY);
                this.ctx.fill();
                this.ctx.translate(-offsetX, -offsetY);
            };
            CanvasRenderer.prototype.resizeImage = function (image, width, height) {
                var _a;
                if (image.width === width && image.height === height) {
                    return image;
                }
                var ownerDocument = (_a = this.canvas.ownerDocument) !== null && _a !== void 0 ? _a : document;
                var canvas = ownerDocument.createElement('canvas');
                canvas.width = Math.max(1, width);
                canvas.height = Math.max(1, height);
                var ctx = canvas.getContext('2d');
                ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, width, height);
                return canvas;
            };
            CanvasRenderer.prototype.renderBackgroundImage = function (container) {
                return __awaiter(this, void 0, void 0, function () {
                    var index, _loop_1, this_1, _i, _a, backgroundImage;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                index = container.styles.backgroundImage.length - 1;
                                _loop_1 = function (backgroundImage) {
                                    var image, url, _c, path, x, y, width, height, pattern, _d, path, x, y, width, height, _e, lineLength, x0, x1, y0, y1, canvas, ctx, gradient_1, pattern, _f, path, left, top_1, width, height, position, x, y, _g, rx, ry, radialGradient_1, midX, midY, f, invF;
                                    return __generator(this, function (_h) {
                                        switch (_h.label) {
                                            case 0:
                                                if (!(backgroundImage.type === CSSImageType.URL)) return [3 /*break*/, 5];
                                                image = void 0;
                                                url = backgroundImage.url;
                                                _h.label = 1;
                                            case 1:
                                                _h.trys.push([1, 3, , 4]);
                                                return [4 /*yield*/, this_1.options.cache.match(url)];
                                            case 2:
                                                image = _h.sent();
                                                return [3 /*break*/, 4];
                                            case 3:
                                                _h.sent();
                                                Logger.getInstance(this_1.options.id).error("Error loading background-image " + url);
                                                return [3 /*break*/, 4];
                                            case 4:
                                                if (image) {
                                                    _c = calculateBackgroundRendering(container, index, [
                                                        image.width,
                                                        image.height,
                                                        image.width / image.height
                                                    ]), path = _c[0], x = _c[1], y = _c[2], width = _c[3], height = _c[4];
                                                    pattern = this_1.ctx.createPattern(this_1.resizeImage(image, width, height), 'repeat');
                                                    this_1.renderRepeat(path, pattern, x, y);
                                                }
                                                return [3 /*break*/, 6];
                                            case 5:
                                                if (isLinearGradient(backgroundImage)) {
                                                    _d = calculateBackgroundRendering(container, index, [null, null, null]), path = _d[0], x = _d[1], y = _d[2], width = _d[3], height = _d[4];
                                                    _e = calculateGradientDirection(backgroundImage.angle, width, height), lineLength = _e[0], x0 = _e[1], x1 = _e[2], y0 = _e[3], y1 = _e[4];
                                                    canvas = document.createElement('canvas');
                                                    canvas.width = width;
                                                    canvas.height = height;
                                                    ctx = canvas.getContext('2d');
                                                    gradient_1 = ctx.createLinearGradient(x0, y0, x1, y1);
                                                    processColorStops(backgroundImage.stops, lineLength).forEach(function (colorStop) {
                                                        return gradient_1.addColorStop(colorStop.stop, asString(colorStop.color));
                                                    });
                                                    ctx.fillStyle = gradient_1;
                                                    ctx.fillRect(0, 0, width, height);
                                                    if (width > 0 && height > 0) {
                                                        pattern = this_1.ctx.createPattern(canvas, 'repeat');
                                                        this_1.renderRepeat(path, pattern, x, y);
                                                    }
                                                }
                                                else if (isRadialGradient(backgroundImage)) {
                                                    _f = calculateBackgroundRendering(container, index, [
                                                        null,
                                                        null,
                                                        null
                                                    ]), path = _f[0], left = _f[1], top_1 = _f[2], width = _f[3], height = _f[4];
                                                    position = backgroundImage.position.length === 0 ? [FIFTY_PERCENT] : backgroundImage.position;
                                                    x = getAbsoluteValue(position[0], width);
                                                    y = getAbsoluteValue(position[position.length - 1], height);
                                                    _g = calculateRadius(backgroundImage, x, y, width, height), rx = _g[0], ry = _g[1];
                                                    if (rx > 0 && rx > 0) {
                                                        radialGradient_1 = this_1.ctx.createRadialGradient(left + x, top_1 + y, 0, left + x, top_1 + y, rx);
                                                        processColorStops(backgroundImage.stops, rx * 2).forEach(function (colorStop) {
                                                            return radialGradient_1.addColorStop(colorStop.stop, asString(colorStop.color));
                                                        });
                                                        this_1.path(path);
                                                        this_1.ctx.fillStyle = radialGradient_1;
                                                        if (rx !== ry) {
                                                            midX = container.bounds.left + 0.5 * container.bounds.width;
                                                            midY = container.bounds.top + 0.5 * container.bounds.height;
                                                            f = ry / rx;
                                                            invF = 1 / f;
                                                            this_1.ctx.save();
                                                            this_1.ctx.translate(midX, midY);
                                                            this_1.ctx.transform(1, 0, 0, f, 0, 0);
                                                            this_1.ctx.translate(-midX, -midY);
                                                            this_1.ctx.fillRect(left, invF * (top_1 - midY) + midY, width, height * invF);
                                                            this_1.ctx.restore();
                                                        }
                                                        else {
                                                            this_1.ctx.fill();
                                                        }
                                                    }
                                                }
                                                _h.label = 6;
                                            case 6:
                                                index--;
                                                return [2 /*return*/];
                                        }
                                    });
                                };
                                this_1 = this;
                                _i = 0, _a = container.styles.backgroundImage.slice(0).reverse();
                                _b.label = 1;
                            case 1:
                                if (!(_i < _a.length)) return [3 /*break*/, 4];
                                backgroundImage = _a[_i];
                                return [5 /*yield**/, _loop_1(backgroundImage)];
                            case 2:
                                _b.sent();
                                _b.label = 3;
                            case 3:
                                _i++;
                                return [3 /*break*/, 1];
                            case 4: return [2 /*return*/];
                        }
                    });
                });
            };
            CanvasRenderer.prototype.renderSolidBorder = function (color, side, curvePoints) {
                return __awaiter(this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        this.path(parsePathForBorder(curvePoints, side));
                        this.ctx.fillStyle = asString(color);
                        this.ctx.fill();
                        return [2 /*return*/];
                    });
                });
            };
            CanvasRenderer.prototype.renderDoubleBorder = function (color, width, side, curvePoints) {
                return __awaiter(this, void 0, void 0, function () {
                    var outerPaths, innerPaths;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (!(width < 3)) return [3 /*break*/, 2];
                                return [4 /*yield*/, this.renderSolidBorder(color, side, curvePoints)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                            case 2:
                                outerPaths = parsePathForBorderDoubleOuter(curvePoints, side);
                                this.path(outerPaths);
                                this.ctx.fillStyle = asString(color);
                                this.ctx.fill();
                                innerPaths = parsePathForBorderDoubleInner(curvePoints, side);
                                this.path(innerPaths);
                                this.ctx.fill();
                                return [2 /*return*/];
                        }
                    });
                });
            };
            CanvasRenderer.prototype.renderNodeBackgroundAndBorders = function (paint) {
                return __awaiter(this, void 0, void 0, function () {
                    var styles, hasBackground, borders, backgroundPaintingArea, side, _i, borders_1, border;
                    var _this = this;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                this.applyEffects(paint.effects, 2 /* BACKGROUND_BORDERS */);
                                styles = paint.container.styles;
                                hasBackground = !isTransparent(styles.backgroundColor) || styles.backgroundImage.length;
                                borders = [
                                    { style: styles.borderTopStyle, color: styles.borderTopColor, width: styles.borderTopWidth },
                                    { style: styles.borderRightStyle, color: styles.borderRightColor, width: styles.borderRightWidth },
                                    { style: styles.borderBottomStyle, color: styles.borderBottomColor, width: styles.borderBottomWidth },
                                    { style: styles.borderLeftStyle, color: styles.borderLeftColor, width: styles.borderLeftWidth }
                                ];
                                backgroundPaintingArea = calculateBackgroundCurvedPaintingArea(getBackgroundValueForIndex(styles.backgroundClip, 0), paint.curves);
                                if (!(hasBackground || styles.boxShadow.length)) return [3 /*break*/, 2];
                                this.ctx.save();
                                this.path(backgroundPaintingArea);
                                this.ctx.clip();
                                if (!isTransparent(styles.backgroundColor)) {
                                    this.ctx.fillStyle = asString(styles.backgroundColor);
                                    this.ctx.fill();
                                }
                                return [4 /*yield*/, this.renderBackgroundImage(paint.container)];
                            case 1:
                                _a.sent();
                                this.ctx.restore();
                                styles.boxShadow
                                    .slice(0)
                                    .reverse()
                                    .forEach(function (shadow) {
                                    _this.ctx.save();
                                    var borderBoxArea = calculateBorderBoxPath(paint.curves);
                                    var maskOffset = shadow.inset ? 0 : MASK_OFFSET;
                                    var shadowPaintingArea = transformPath(borderBoxArea, -maskOffset + (shadow.inset ? 1 : -1) * shadow.spread.number, (shadow.inset ? 1 : -1) * shadow.spread.number, shadow.spread.number * (shadow.inset ? -2 : 2), shadow.spread.number * (shadow.inset ? -2 : 2));
                                    if (shadow.inset) {
                                        _this.path(borderBoxArea);
                                        _this.ctx.clip();
                                        _this.mask(shadowPaintingArea);
                                    }
                                    else {
                                        _this.mask(borderBoxArea);
                                        _this.ctx.clip();
                                        _this.path(shadowPaintingArea);
                                    }
                                    _this.ctx.shadowOffsetX = shadow.offsetX.number + maskOffset;
                                    _this.ctx.shadowOffsetY = shadow.offsetY.number;
                                    _this.ctx.shadowColor = asString(shadow.color);
                                    _this.ctx.shadowBlur = shadow.blur.number;
                                    _this.ctx.fillStyle = shadow.inset ? asString(shadow.color) : 'rgba(0,0,0,1)';
                                    _this.ctx.fill();
                                    _this.ctx.restore();
                                });
                                _a.label = 2;
                            case 2:
                                side = 0;
                                _i = 0, borders_1 = borders;
                                _a.label = 3;
                            case 3:
                                if (!(_i < borders_1.length)) return [3 /*break*/, 13];
                                border = borders_1[_i];
                                if (!(border.style !== BORDER_STYLE.NONE && !isTransparent(border.color) && border.width > 0)) return [3 /*break*/, 11];
                                if (!(border.style === BORDER_STYLE.DASHED)) return [3 /*break*/, 5];
                                return [4 /*yield*/, this.renderDashedDottedBorder(border.color, border.width, side, paint.curves, BORDER_STYLE.DASHED)];
                            case 4:
                                _a.sent();
                                return [3 /*break*/, 11];
                            case 5:
                                if (!(border.style === BORDER_STYLE.DOTTED)) return [3 /*break*/, 7];
                                return [4 /*yield*/, this.renderDashedDottedBorder(border.color, border.width, side, paint.curves, BORDER_STYLE.DOTTED)];
                            case 6:
                                _a.sent();
                                return [3 /*break*/, 11];
                            case 7:
                                if (!(border.style === BORDER_STYLE.DOUBLE)) return [3 /*break*/, 9];
                                return [4 /*yield*/, this.renderDoubleBorder(border.color, border.width, side, paint.curves)];
                            case 8:
                                _a.sent();
                                return [3 /*break*/, 11];
                            case 9: return [4 /*yield*/, this.renderSolidBorder(border.color, side, paint.curves)];
                            case 10:
                                _a.sent();
                                _a.label = 11;
                            case 11:
                                side++;
                                _a.label = 12;
                            case 12:
                                _i++;
                                return [3 /*break*/, 3];
                            case 13: return [2 /*return*/];
                        }
                    });
                });
            };
            CanvasRenderer.prototype.renderDashedDottedBorder = function (color, width, side, curvePoints, style) {
                return __awaiter(this, void 0, void 0, function () {
                    var strokePaths, boxPaths, startX, startY, endX, endY, length, dashLength, spaceLength, useLineDash, multiplier, numberOfDashes, minSpace, maxSpace, path1, path2, path1, path2;
                    return __generator(this, function (_a) {
                        this.ctx.save();
                        strokePaths = parsePathForBorderStroke(curvePoints, side);
                        boxPaths = parsePathForBorder(curvePoints, side);
                        if (style === BORDER_STYLE.DASHED) {
                            this.path(boxPaths);
                            this.ctx.clip();
                        }
                        if (isBezierCurve(boxPaths[0])) {
                            startX = boxPaths[0].start.x;
                            startY = boxPaths[0].start.y;
                        }
                        else {
                            startX = boxPaths[0].x;
                            startY = boxPaths[0].y;
                        }
                        if (isBezierCurve(boxPaths[1])) {
                            endX = boxPaths[1].end.x;
                            endY = boxPaths[1].end.y;
                        }
                        else {
                            endX = boxPaths[1].x;
                            endY = boxPaths[1].y;
                        }
                        if (side === 0 || side === 2) {
                            length = Math.abs(startX - endX);
                        }
                        else {
                            length = Math.abs(startY - endY);
                        }
                        this.ctx.beginPath();
                        if (style === BORDER_STYLE.DOTTED) {
                            this.formatPath(strokePaths);
                        }
                        else {
                            this.formatPath(boxPaths.slice(0, 2));
                        }
                        dashLength = width < 3 ? width * 3 : width * 2;
                        spaceLength = width < 3 ? width * 2 : width;
                        if (style === BORDER_STYLE.DOTTED) {
                            dashLength = width;
                            spaceLength = width;
                        }
                        useLineDash = true;
                        if (length <= dashLength * 2) {
                            useLineDash = false;
                        }
                        else if (length <= dashLength * 2 + spaceLength) {
                            multiplier = length / (2 * dashLength + spaceLength);
                            dashLength *= multiplier;
                            spaceLength *= multiplier;
                        }
                        else {
                            numberOfDashes = Math.floor((length + spaceLength) / (dashLength + spaceLength));
                            minSpace = (length - numberOfDashes * dashLength) / (numberOfDashes - 1);
                            maxSpace = (length - (numberOfDashes + 1) * dashLength) / numberOfDashes;
                            spaceLength =
                                maxSpace <= 0 || Math.abs(spaceLength - minSpace) < Math.abs(spaceLength - maxSpace)
                                    ? minSpace
                                    : maxSpace;
                        }
                        if (useLineDash) {
                            if (style === BORDER_STYLE.DOTTED) {
                                this.ctx.setLineDash([0, dashLength + spaceLength]);
                            }
                            else {
                                this.ctx.setLineDash([dashLength, spaceLength]);
                            }
                        }
                        if (style === BORDER_STYLE.DOTTED) {
                            this.ctx.lineCap = 'round';
                            this.ctx.lineWidth = width;
                        }
                        else {
                            this.ctx.lineWidth = width * 2 + 1.1;
                        }
                        this.ctx.strokeStyle = asString(color);
                        this.ctx.stroke();
                        this.ctx.setLineDash([]);
                        // dashed round edge gap
                        if (style === BORDER_STYLE.DASHED) {
                            if (isBezierCurve(boxPaths[0])) {
                                path1 = boxPaths[3];
                                path2 = boxPaths[0];
                                this.ctx.beginPath();
                                this.formatPath([new Vector(path1.end.x, path1.end.y), new Vector(path2.start.x, path2.start.y)]);
                                this.ctx.stroke();
                            }
                            if (isBezierCurve(boxPaths[1])) {
                                path1 = boxPaths[1];
                                path2 = boxPaths[2];
                                this.ctx.beginPath();
                                this.formatPath([new Vector(path1.end.x, path1.end.y), new Vector(path2.start.x, path2.start.y)]);
                                this.ctx.stroke();
                            }
                        }
                        this.ctx.restore();
                        return [2 /*return*/];
                    });
                });
            };
            CanvasRenderer.prototype.render = function (element) {
                return __awaiter(this, void 0, void 0, function () {
                    var stack;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (this.options.backgroundColor) {
                                    this.ctx.fillStyle = asString(this.options.backgroundColor);
                                    this.ctx.fillRect(this.options.x - this.options.scrollX, this.options.y - this.options.scrollY, this.options.width, this.options.height);
                                }
                                stack = parseStackingContexts(element);
                                return [4 /*yield*/, this.renderStack(stack)];
                            case 1:
                                _a.sent();
                                this.applyEffects([], 2 /* BACKGROUND_BORDERS */);
                                return [2 /*return*/, this.canvas];
                        }
                    });
                });
            };
            return CanvasRenderer;
        }());
        var isTextInputElement = function (container) {
            if (container instanceof TextareaElementContainer) {
                return true;
            }
            else if (container instanceof SelectElementContainer) {
                return true;
            }
            else if (container instanceof InputElementContainer && container.type !== RADIO && container.type !== CHECKBOX) {
                return true;
            }
            return false;
        };
        var calculateBackgroundCurvedPaintingArea = function (clip, curves) {
            switch (clip) {
                case BACKGROUND_CLIP.BORDER_BOX:
                    return calculateBorderBoxPath(curves);
                case BACKGROUND_CLIP.CONTENT_BOX:
                    return calculateContentBoxPath(curves);
                case BACKGROUND_CLIP.PADDING_BOX:
                default:
                    return calculatePaddingBoxPath(curves);
            }
        };
        var canvasTextAlign = function (textAlign) {
            switch (textAlign) {
                case TEXT_ALIGN.CENTER:
                    return 'center';
                case TEXT_ALIGN.RIGHT:
                    return 'right';
                case TEXT_ALIGN.LEFT:
                default:
                    return 'left';
            }
        };

        var ForeignObjectRenderer = /** @class */ (function () {
            function ForeignObjectRenderer(options) {
                this.canvas = options.canvas ? options.canvas : document.createElement('canvas');
                this.ctx = this.canvas.getContext('2d');
                this.options = options;
                this.canvas.width = Math.floor(options.width * options.scale);
                this.canvas.height = Math.floor(options.height * options.scale);
                this.canvas.style.width = options.width + "px";
                this.canvas.style.height = options.height + "px";
                this.ctx.scale(this.options.scale, this.options.scale);
                this.ctx.translate(-options.x + options.scrollX, -options.y + options.scrollY);
                Logger.getInstance(options.id).debug("EXPERIMENTAL ForeignObject renderer initialized (" + options.width + "x" + options.height + " at " + options.x + "," + options.y + ") with scale " + options.scale);
            }
            ForeignObjectRenderer.prototype.render = function (element) {
                return __awaiter(this, void 0, void 0, function () {
                    var svg, img;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                svg = createForeignObjectSVG(Math.max(this.options.windowWidth, this.options.width) * this.options.scale, Math.max(this.options.windowHeight, this.options.height) * this.options.scale, this.options.scrollX * this.options.scale, this.options.scrollY * this.options.scale, element);
                                return [4 /*yield*/, loadSerializedSVG(svg)];
                            case 1:
                                img = _a.sent();
                                if (this.options.backgroundColor) {
                                    this.ctx.fillStyle = asString(this.options.backgroundColor);
                                    this.ctx.fillRect(0, 0, this.options.width * this.options.scale, this.options.height * this.options.scale);
                                }
                                this.ctx.drawImage(img, -this.options.x * this.options.scale, -this.options.y * this.options.scale);
                                return [2 /*return*/, this.canvas];
                        }
                    });
                });
            };
            return ForeignObjectRenderer;
        }());
        var loadSerializedSVG = function (svg) {
            return new Promise(function (resolve, reject) {
                var img = new Image();
                img.onload = function () {
                    resolve(img);
                };
                img.onerror = reject;
                img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
            });
        };

        var parseColor = function (value) { return color$1.parse(Parser.create(value).parseComponentValue()); };
        var html2canvas = function (element, options) {
            if (options === void 0) { options = {}; }
            return renderElement(element, options);
        };
        if (typeof window !== 'undefined') {
            CacheStorage.setContext(window);
        }
        var instanceCount = 1;
        var renderElement = function (element, opts) { return __awaiter(void 0, void 0, void 0, function () {
            var ownerDocument, defaultView, instanceName, _a, width, height, left, top, defaultResourceOptions, resourceOptions, defaultOptions, options, windowBounds, documentCloner, clonedElement, container, documentBackgroundColor, bodyBackgroundColor, bgColor, defaultBackgroundColor, backgroundColor, renderOptions, canvas, renderer, root, renderer;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!element || typeof element !== 'object') {
                            return [2 /*return*/, Promise.reject('Invalid element provided as first argument')];
                        }
                        ownerDocument = element.ownerDocument;
                        if (!ownerDocument) {
                            throw new Error("Element is not attached to a Document");
                        }
                        defaultView = ownerDocument.defaultView;
                        if (!defaultView) {
                            throw new Error("Document is not attached to a Window");
                        }
                        instanceName = "#" + instanceCount++;
                        _a = isBodyElement(element) || isHTMLElement(element) ? parseDocumentSize(ownerDocument) : parseBounds(element), width = _a.width, height = _a.height, left = _a.left, top = _a.top;
                        defaultResourceOptions = {
                            allowTaint: false,
                            imageTimeout: 15000,
                            proxy: undefined,
                            useCORS: false
                        };
                        resourceOptions = __assign(__assign({}, defaultResourceOptions), opts);
                        defaultOptions = {
                            backgroundColor: '#ffffff',
                            cache: opts.cache ? opts.cache : CacheStorage.create(instanceName, resourceOptions),
                            logging: true,
                            removeContainer: true,
                            foreignObjectRendering: false,
                            scale: defaultView.devicePixelRatio || 1,
                            windowWidth: defaultView.innerWidth,
                            windowHeight: defaultView.innerHeight,
                            scrollX: defaultView.pageXOffset,
                            scrollY: defaultView.pageYOffset,
                            x: left,
                            y: top,
                            width: Math.ceil(width),
                            height: Math.ceil(height),
                            id: instanceName
                        };
                        options = __assign(__assign(__assign({}, defaultOptions), resourceOptions), opts);
                        windowBounds = new Bounds(options.scrollX, options.scrollY, options.windowWidth, options.windowHeight);
                        Logger.create({ id: instanceName, enabled: options.logging });
                        Logger.getInstance(instanceName).debug("Starting document clone");
                        documentCloner = new DocumentCloner(element, {
                            id: instanceName,
                            onclone: options.onclone,
                            ignoreElements: options.ignoreElements,
                            inlineImages: options.foreignObjectRendering,
                            copyStyles: options.foreignObjectRendering
                        });
                        clonedElement = documentCloner.clonedReferenceElement;
                        if (!clonedElement) {
                            return [2 /*return*/, Promise.reject("Unable to find element in cloned iframe")];
                        }
                        return [4 /*yield*/, documentCloner.toIFrame(ownerDocument, windowBounds)];
                    case 1:
                        container = _b.sent();
                        documentBackgroundColor = ownerDocument.documentElement
                            ? parseColor(getComputedStyle(ownerDocument.documentElement).backgroundColor)
                            : COLORS.TRANSPARENT;
                        bodyBackgroundColor = ownerDocument.body
                            ? parseColor(getComputedStyle(ownerDocument.body).backgroundColor)
                            : COLORS.TRANSPARENT;
                        bgColor = opts.backgroundColor;
                        defaultBackgroundColor = typeof bgColor === 'string' ? parseColor(bgColor) : bgColor === null ? COLORS.TRANSPARENT : 0xffffffff;
                        backgroundColor = element === ownerDocument.documentElement
                            ? isTransparent(documentBackgroundColor)
                                ? isTransparent(bodyBackgroundColor)
                                    ? defaultBackgroundColor
                                    : bodyBackgroundColor
                                : documentBackgroundColor
                            : defaultBackgroundColor;
                        renderOptions = {
                            id: instanceName,
                            cache: options.cache,
                            canvas: options.canvas,
                            backgroundColor: backgroundColor,
                            scale: options.scale,
                            x: options.x,
                            y: options.y,
                            scrollX: options.scrollX,
                            scrollY: options.scrollY,
                            width: options.width,
                            height: options.height,
                            windowWidth: options.windowWidth,
                            windowHeight: options.windowHeight
                        };
                        if (!options.foreignObjectRendering) return [3 /*break*/, 3];
                        Logger.getInstance(instanceName).debug("Document cloned, using foreign object rendering");
                        renderer = new ForeignObjectRenderer(renderOptions);
                        return [4 /*yield*/, renderer.render(clonedElement)];
                    case 2:
                        canvas = _b.sent();
                        return [3 /*break*/, 5];
                    case 3:
                        Logger.getInstance(instanceName).debug("Document cloned, using computed rendering");
                        CacheStorage.attachInstance(options.cache);
                        Logger.getInstance(instanceName).debug("Starting DOM parsing");
                        root = parseTree(clonedElement);
                        CacheStorage.detachInstance();
                        if (backgroundColor === root.styles.backgroundColor) {
                            root.styles.backgroundColor = COLORS.TRANSPARENT;
                        }
                        Logger.getInstance(instanceName).debug("Starting renderer");
                        renderer = new CanvasRenderer(renderOptions);
                        return [4 /*yield*/, renderer.render(root)];
                    case 4:
                        canvas = _b.sent();
                        _b.label = 5;
                    case 5:
                        if (options.removeContainer === true) {
                            if (!DocumentCloner.destroy(container)) {
                                Logger.getInstance(instanceName).error("Cannot detach cloned iframe as it is not in the DOM anymore");
                            }
                        }
                        Logger.getInstance(instanceName).debug("Finished rendering");
                        Logger.destroy(instanceName);
                        CacheStorage.destroy(instanceName);
                        return [2 /*return*/, canvas];
                }
            });
        }); };

        return html2canvas;

    })));

    });

    /* src\PowerRankings.svelte generated by Svelte v3.38.3 */
    const file$4 = "src\\PowerRankings.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i];
    	return child_ctx;
    }

    // (41:8) {#each powerRankings as team (team.id)}
    function create_each_block$1(key_1, ctx) {
    	let first;
    	let teampr;
    	let current;

    	teampr = new TeamPR({
    			props: {
    				team: /*team*/ ctx[3].team,
    				logo: /*team*/ ctx[3].logo,
    				standing: /*team*/ ctx[3].id,
    				top: /*team*/ ctx[3].top,
    				left: /*team*/ ctx[3].left
    			},
    			$$inline: true
    		});

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(teampr.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(teampr, target, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			const teampr_changes = {};
    			if (dirty & /*powerRankings*/ 1) teampr_changes.team = /*team*/ ctx[3].team;
    			if (dirty & /*powerRankings*/ 1) teampr_changes.logo = /*team*/ ctx[3].logo;
    			if (dirty & /*powerRankings*/ 1) teampr_changes.standing = /*team*/ ctx[3].id;
    			if (dirty & /*powerRankings*/ 1) teampr_changes.top = /*team*/ ctx[3].top;
    			if (dirty & /*powerRankings*/ 1) teampr_changes.left = /*team*/ ctx[3].left;
    			teampr.$set(teampr_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(teampr.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(teampr.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(teampr, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(41:8) {#each powerRankings as team (team.id)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let div1;
    	let div0;
    	let h1;
    	let t0;
    	let t1;
    	let h1_transition;
    	let t2;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t3;
    	let button;
    	let div1_transition;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*powerRankings*/ ctx[0];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*team*/ ctx[3].id;
    	validate_each_keys(ctx, each_value, get_each_context$1, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$1(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$1(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			t0 = text(/*league*/ ctx[1]);
    			t1 = text(" Power Rankings");
    			t2 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t3 = space();
    			button = element("button");
    			button.textContent = "Download Image";
    			attr_dev(h1, "class", "svelte-1si54f");
    			add_location(h1, file$4, 39, 8, 1183);
    			attr_dev(div0, "class", "contain svelte-1si54f");
    			attr_dev(div0, "id", "image");
    			add_location(div0, file$4, 38, 4, 1141);
    			attr_dev(button, "class", "svelte-1si54f");
    			add_location(button, file$4, 44, 4, 1442);
    			attr_dev(div1, "class", "back svelte-1si54f");
    			add_location(div1, file$4, 37, 0, 1065);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, h1);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			append_dev(div0, t2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			append_dev(div1, t3);
    			append_dev(div1, button);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*DownloadAsImage*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*league*/ 2) set_data_dev(t0, /*league*/ ctx[1]);

    			if (dirty & /*powerRankings*/ 1) {
    				each_value = /*powerRankings*/ ctx[0];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context$1, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div0, outro_and_destroy_block, create_each_block$1, null, get_each_context$1);
    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!h1_transition) h1_transition = create_bidirectional_transition(h1, fade, { duration: 3000 }, true);
    				h1_transition.run(1);
    			});

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			add_render_callback(() => {
    				if (!div1_transition) div1_transition = create_bidirectional_transition(div1, fade, { duration: 1000, ease: "circ" }, true);
    				div1_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!h1_transition) h1_transition = create_bidirectional_transition(h1, fade, { duration: 3000 }, false);
    			h1_transition.run(0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			if (!div1_transition) div1_transition = create_bidirectional_transition(div1, fade, { duration: 1000, ease: "circ" }, false);
    			div1_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (detaching && h1_transition) h1_transition.end();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			if (detaching && div1_transition) div1_transition.end();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function downloadURI(uri, name) {
    	var link = document.createElement("a");
    	link.download = name;
    	link.href = uri;
    	document.getElementById("image").appendChild(link);
    	link.click();
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("PowerRankings", slots, []);
    	let { powerRankings = [] } = $$props;
    	let { league = "" } = $$props;

    	onMount(() => {
    		store.powerRankings(currentMessage => {
    			$$invalidate(0, powerRankings = currentMessage);
    		});

    		store.league(currentMessage => {
    			$$invalidate(1, league = currentMessage);
    		});
    	});

    	function DownloadAsImage() {
    		var element = document.getElementById("image");

    		html2canvas(element, {
    			logging: true,
    			letterRendering: 1,
    			allowTaint: false
    		}).then(function (canvas) {
    			var myImage = canvas.toDataURL("image/png");
    			downloadURI(myImage, league + ".png");
    		});
    	}

    	const writable_props = ["powerRankings", "league"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<PowerRankings> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("powerRankings" in $$props) $$invalidate(0, powerRankings = $$props.powerRankings);
    		if ("league" in $$props) $$invalidate(1, league = $$props.league);
    	};

    	$$self.$capture_state = () => ({
    		fade,
    		onMount,
    		store,
    		TeamPR,
    		html2canvas,
    		powerRankings,
    		league,
    		downloadURI,
    		DownloadAsImage
    	});

    	$$self.$inject_state = $$props => {
    		if ("powerRankings" in $$props) $$invalidate(0, powerRankings = $$props.powerRankings);
    		if ("league" in $$props) $$invalidate(1, league = $$props.league);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [powerRankings, league, DownloadAsImage];
    }

    class PowerRankings extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { powerRankings: 0, league: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PowerRankings",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get powerRankings() {
    		throw new Error("<PowerRankings>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set powerRankings(value) {
    		throw new Error("<PowerRankings>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get league() {
    		throw new Error("<PowerRankings>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set league(value) {
    		throw new Error("<PowerRankings>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\DefaultScene.svelte generated by Svelte v3.38.3 */
    const file$3 = "src\\DefaultScene.svelte";

    function create_fragment$3(ctx) {
    	let div;
    	let img;
    	let img_src_value;
    	let div_transition;
    	let current;

    	const block = {
    		c: function create() {
    			div = element("div");
    			img = element("img");
    			if (img.src !== (img_src_value = "https://media.discordapp.net/attachments/854484965080039444/866892026549501992/rlpcbackgroundfinal.png?width=1920&height=1080")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "class", "svelte-1b4nkp6");
    			add_location(img, file$3, 5, 4, 148);
    			attr_dev(div, "class", "contain svelte-1b4nkp6");
    			add_location(div, file$3, 4, 0, 69);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { duration: 1000, ease: "circ" }, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { duration: 1000, ease: "circ" }, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching && div_transition) div_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("DefaultScene", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<DefaultScene> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ fade });
    	return [];
    }

    class DefaultScene extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "DefaultScene",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src\SinglePlayer.svelte generated by Svelte v3.38.3 */
    const file$2 = "src\\SinglePlayer.svelte";

    function create_fragment$2(ctx) {
    	let div7;
    	let div0;
    	let t0;
    	let t1;
    	let div1;
    	let t2;
    	let t3;
    	let div6;
    	let div2;
    	let t4;
    	let t5;
    	let t6;
    	let div3;
    	let t7;
    	let t8;
    	let t9;
    	let div4;
    	let t10;
    	let t11;
    	let t12;
    	let div5;
    	let t13;
    	let t14;
    	let div6_transition;
    	let div7_transition;
    	let current;

    	const block = {
    		c: function create() {
    			div7 = element("div");
    			div0 = element("div");
    			t0 = text(/*name*/ ctx[3]);
    			t1 = space();
    			div1 = element("div");
    			t2 = text(/*mmr*/ ctx[4]);
    			t3 = space();
    			div6 = element("div");
    			div2 = element("div");
    			t4 = text("Goals: ");
    			t5 = text(/*goals*/ ctx[0]);
    			t6 = space();
    			div3 = element("div");
    			t7 = text("Assists: ");
    			t8 = text(/*assists*/ ctx[1]);
    			t9 = space();
    			div4 = element("div");
    			t10 = text("Saves: ");
    			t11 = text(/*saves*/ ctx[2]);
    			t12 = space();
    			div5 = element("div");
    			t13 = text("Games: ");
    			t14 = text(/*games*/ ctx[5]);
    			attr_dev(div0, "class", "name svelte-eqqx88");
    			add_location(div0, file$2, 21, 4, 488);
    			attr_dev(div1, "class", "mmr svelte-eqqx88");
    			add_location(div1, file$2, 22, 4, 524);
    			attr_dev(div2, "class", "goals svelte-eqqx88");
    			add_location(div2, file$2, 24, 8, 657);
    			attr_dev(div3, "class", "assists svelte-eqqx88");
    			add_location(div3, file$2, 25, 8, 706);
    			attr_dev(div4, "class", "saves svelte-eqqx88");
    			add_location(div4, file$2, 26, 8, 761);
    			attr_dev(div5, "class", "games svelte-eqqx88");
    			add_location(div5, file$2, 27, 8, 810);
    			attr_dev(div6, "class", "delayReveal svelte-eqqx88");
    			add_location(div6, file$2, 23, 4, 558);
    			attr_dev(div7, "class", "player svelte-eqqx88");
    			add_location(div7, file$2, 20, 0, 411);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div7, anchor);
    			append_dev(div7, div0);
    			append_dev(div0, t0);
    			append_dev(div7, t1);
    			append_dev(div7, div1);
    			append_dev(div1, t2);
    			append_dev(div7, t3);
    			append_dev(div7, div6);
    			append_dev(div6, div2);
    			append_dev(div2, t4);
    			append_dev(div2, t5);
    			append_dev(div6, t6);
    			append_dev(div6, div3);
    			append_dev(div3, t7);
    			append_dev(div3, t8);
    			append_dev(div6, t9);
    			append_dev(div6, div4);
    			append_dev(div4, t10);
    			append_dev(div4, t11);
    			append_dev(div6, t12);
    			append_dev(div6, div5);
    			append_dev(div5, t13);
    			append_dev(div5, t14);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*name*/ 8) set_data_dev(t0, /*name*/ ctx[3]);
    			if (!current || dirty & /*mmr*/ 16) set_data_dev(t2, /*mmr*/ ctx[4]);
    			if (!current || dirty & /*goals*/ 1) set_data_dev(t5, /*goals*/ ctx[0]);
    			if (!current || dirty & /*assists*/ 2) set_data_dev(t8, /*assists*/ ctx[1]);
    			if (!current || dirty & /*saves*/ 4) set_data_dev(t11, /*saves*/ ctx[2]);
    			if (!current || dirty & /*games*/ 32) set_data_dev(t14, /*games*/ ctx[5]);
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div6_transition) div6_transition = create_bidirectional_transition(
    					div6,
    					slide,
    					{
    						delay: 3000,
    						duration: 1000,
    						ease: "circ"
    					},
    					true
    				);

    				div6_transition.run(1);
    			});

    			add_render_callback(() => {
    				if (!div7_transition) div7_transition = create_bidirectional_transition(div7, fade, { duration: 3000, ease: "circ" }, true);
    				div7_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div6_transition) div6_transition = create_bidirectional_transition(
    				div6,
    				slide,
    				{
    					delay: 3000,
    					duration: 1000,
    					ease: "circ"
    				},
    				false
    			);

    			div6_transition.run(0);
    			if (!div7_transition) div7_transition = create_bidirectional_transition(div7, fade, { duration: 3000, ease: "circ" }, false);
    			div7_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div7);
    			if (detaching && div6_transition) div6_transition.end();
    			if (detaching && div7_transition) div7_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("SinglePlayer", slots, []);
    	let { name } = $$props;
    	let { goals } = $$props;
    	let { assists } = $$props;
    	let { saves } = $$props;
    	let { mmr } = $$props;
    	let { games } = $$props;

    	if (goals == "") {
    		goals = 0;
    	}

    	if (assists == "") {
    		assists = 0;
    	}

    	if (saves == "") {
    		saves = 0;
    	}

    	const writable_props = ["name", "goals", "assists", "saves", "mmr", "games"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<SinglePlayer> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("name" in $$props) $$invalidate(3, name = $$props.name);
    		if ("goals" in $$props) $$invalidate(0, goals = $$props.goals);
    		if ("assists" in $$props) $$invalidate(1, assists = $$props.assists);
    		if ("saves" in $$props) $$invalidate(2, saves = $$props.saves);
    		if ("mmr" in $$props) $$invalidate(4, mmr = $$props.mmr);
    		if ("games" in $$props) $$invalidate(5, games = $$props.games);
    	};

    	$$self.$capture_state = () => ({
    		fade,
    		slide,
    		name,
    		goals,
    		assists,
    		saves,
    		mmr,
    		games
    	});

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(3, name = $$props.name);
    		if ("goals" in $$props) $$invalidate(0, goals = $$props.goals);
    		if ("assists" in $$props) $$invalidate(1, assists = $$props.assists);
    		if ("saves" in $$props) $$invalidate(2, saves = $$props.saves);
    		if ("mmr" in $$props) $$invalidate(4, mmr = $$props.mmr);
    		if ("games" in $$props) $$invalidate(5, games = $$props.games);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [goals, assists, saves, name, mmr, games];
    }

    class SinglePlayer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			name: 3,
    			goals: 0,
    			assists: 1,
    			saves: 2,
    			mmr: 4,
    			games: 5
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "SinglePlayer",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*name*/ ctx[3] === undefined && !("name" in props)) {
    			console.warn("<SinglePlayer> was created without expected prop 'name'");
    		}

    		if (/*goals*/ ctx[0] === undefined && !("goals" in props)) {
    			console.warn("<SinglePlayer> was created without expected prop 'goals'");
    		}

    		if (/*assists*/ ctx[1] === undefined && !("assists" in props)) {
    			console.warn("<SinglePlayer> was created without expected prop 'assists'");
    		}

    		if (/*saves*/ ctx[2] === undefined && !("saves" in props)) {
    			console.warn("<SinglePlayer> was created without expected prop 'saves'");
    		}

    		if (/*mmr*/ ctx[4] === undefined && !("mmr" in props)) {
    			console.warn("<SinglePlayer> was created without expected prop 'mmr'");
    		}

    		if (/*games*/ ctx[5] === undefined && !("games" in props)) {
    			console.warn("<SinglePlayer> was created without expected prop 'games'");
    		}
    	}

    	get name() {
    		throw new Error("<SinglePlayer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<SinglePlayer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get goals() {
    		throw new Error("<SinglePlayer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set goals(value) {
    		throw new Error("<SinglePlayer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get assists() {
    		throw new Error("<SinglePlayer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set assists(value) {
    		throw new Error("<SinglePlayer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get saves() {
    		throw new Error("<SinglePlayer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set saves(value) {
    		throw new Error("<SinglePlayer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get mmr() {
    		throw new Error("<SinglePlayer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mmr(value) {
    		throw new Error("<SinglePlayer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get games() {
    		throw new Error("<SinglePlayer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set games(value) {
    		throw new Error("<SinglePlayer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\PlayerCard.svelte generated by Svelte v3.38.3 */
    const file$1 = "src\\PlayerCard.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	return child_ctx;
    }

    // (18:8) {#each teamPlayers as player (player.id)}
    function create_each_block(key_1, ctx) {
    	let first;
    	let singleplayer;
    	let current;

    	singleplayer = new SinglePlayer({
    			props: {
    				name: /*player*/ ctx[1].name,
    				goals: /*player*/ ctx[1].goals,
    				assists: /*player*/ ctx[1].assists,
    				saves: /*player*/ ctx[1].saves,
    				mmr: /*player*/ ctx[1].mmr,
    				games: /*player*/ ctx[1].games
    			},
    			$$inline: true
    		});

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(singleplayer.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(singleplayer, target, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			const singleplayer_changes = {};
    			if (dirty & /*teamPlayers*/ 1) singleplayer_changes.name = /*player*/ ctx[1].name;
    			if (dirty & /*teamPlayers*/ 1) singleplayer_changes.goals = /*player*/ ctx[1].goals;
    			if (dirty & /*teamPlayers*/ 1) singleplayer_changes.assists = /*player*/ ctx[1].assists;
    			if (dirty & /*teamPlayers*/ 1) singleplayer_changes.saves = /*player*/ ctx[1].saves;
    			if (dirty & /*teamPlayers*/ 1) singleplayer_changes.mmr = /*player*/ ctx[1].mmr;
    			if (dirty & /*teamPlayers*/ 1) singleplayer_changes.games = /*player*/ ctx[1].games;
    			singleplayer.$set(singleplayer_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(singleplayer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(singleplayer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(singleplayer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(18:8) {#each teamPlayers as player (player.id)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div1;
    	let div0;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let div1_transition;
    	let current;
    	let each_value = /*teamPlayers*/ ctx[0];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*player*/ ctx[1].id;
    	validate_each_keys(ctx, each_value, get_each_context, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div0, "class", "contain");
    			attr_dev(div0, "id", "image");
    			add_location(div0, file$1, 16, 4, 426);
    			attr_dev(div1, "class", "back svelte-ujghi9");
    			add_location(div1, file$1, 15, 0, 350);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*teamPlayers*/ 1) {
    				each_value = /*teamPlayers*/ ctx[0];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div0, outro_and_destroy_block, create_each_block, null, get_each_context);
    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			add_render_callback(() => {
    				if (!div1_transition) div1_transition = create_bidirectional_transition(div1, fade, { duration: 1000, ease: "circ" }, true);
    				div1_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			if (!div1_transition) div1_transition = create_bidirectional_transition(div1, fade, { duration: 1000, ease: "circ" }, false);
    			div1_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			if (detaching && div1_transition) div1_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("PlayerCard", slots, []);
    	let { teamPlayers = [] } = $$props;

    	onMount(() => {
    		store.teamPlayers1(currentMessage => {
    			$$invalidate(0, teamPlayers = currentMessage);
    		});
    	});

    	const writable_props = ["teamPlayers"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<PlayerCard> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("teamPlayers" in $$props) $$invalidate(0, teamPlayers = $$props.teamPlayers);
    	};

    	$$self.$capture_state = () => ({
    		fade,
    		onMount,
    		store,
    		SinglePlayer,
    		teamPlayers
    	});

    	$$self.$inject_state = $$props => {
    		if ("teamPlayers" in $$props) $$invalidate(0, teamPlayers = $$props.teamPlayers);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [teamPlayers];
    }

    class PlayerCard extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { teamPlayers: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PlayerCard",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get teamPlayers() {
    		throw new Error("<PlayerCard>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set teamPlayers(value) {
    		throw new Error("<PlayerCard>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App.svelte generated by Svelte v3.38.3 */
    const file = "src\\App.svelte";

    // (34:36) 
    function create_if_block_3(ctx) {
    	let playercard;
    	let current;
    	playercard = new PlayerCard({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(playercard.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(playercard, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(playercard.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(playercard.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(playercard, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(34:36) ",
    		ctx
    	});

    	return block;
    }

    // (32:37) 
    function create_if_block_2(ctx) {
    	let defaultscene;
    	let current;
    	defaultscene = new DefaultScene({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(defaultscene.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(defaultscene, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(defaultscene.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(defaultscene.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(defaultscene, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(32:37) ",
    		ctx
    	});

    	return block;
    }

    // (30:35) 
    function create_if_block_1(ctx) {
    	let powerrankings;
    	let current;
    	powerrankings = new PowerRankings({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(powerrankings.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(powerrankings, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(powerrankings.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(powerrankings.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(powerrankings, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(30:35) ",
    		ctx
    	});

    	return block;
    }

    // (28:1) {#if currentScene == 'desk'}
    function create_if_block(ctx) {
    	let desk;
    	let current;
    	desk = new Desk({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(desk.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(desk, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(desk.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(desk.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(desk, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(28:1) {#if currentScene == 'desk'}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let html;
    	let t0;
    	let main;
    	let current_block_type_index;
    	let if_block;
    	let t1;
    	let div;
    	let caster;
    	let div_transition;
    	let current;
    	const if_block_creators = [create_if_block, create_if_block_1, create_if_block_2, create_if_block_3];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*currentScene*/ ctx[0] == "desk") return 0;
    		if (/*currentScene*/ ctx[0] == "power") return 1;
    		if (/*currentScene*/ ctx[0] == "default") return 2;
    		if (/*currentScene*/ ctx[0] == "player") return 3;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	caster = new Caster({ $$inline: true });

    	const block = {
    		c: function create() {
    			html = element("html");
    			t0 = space();
    			main = element("main");
    			if (if_block) if_block.c();
    			t1 = space();
    			div = element("div");
    			create_component(caster.$$.fragment);
    			document.title = "RLPC Media Team Site";
    			attr_dev(html, "lang", "en");
    			add_location(html, file, 22, 1, 653);
    			set_style(div, "opacity", /*casterDisplay*/ ctx[1]);
    			add_location(div, file, 37, 1, 916);
    			attr_dev(main, "class", "svelte-kciyl1");
    			add_location(main, file, 25, 0, 688);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			append_dev(document.head, html);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, main, anchor);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(main, null);
    			}

    			append_dev(main, t1);
    			append_dev(main, div);
    			mount_component(caster, div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index !== previous_block_index) {
    				if (if_block) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block = if_blocks[current_block_type_index];

    					if (!if_block) {
    						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block.c();
    					}

    					transition_in(if_block, 1);
    					if_block.m(main, t1);
    				} else {
    					if_block = null;
    				}
    			}

    			if (!current || dirty & /*casterDisplay*/ 2) {
    				set_style(div, "opacity", /*casterDisplay*/ ctx[1]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			transition_in(caster.$$.fragment, local);

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { duration: 3000, ease: "circ" }, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			transition_out(caster.$$.fragment, local);
    			if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { duration: 3000, ease: "circ" }, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			detach_dev(html);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(main);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d();
    			}

    			destroy_component(caster);
    			if (detaching && div_transition) div_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let { currentScene } = $$props;
    	let casterDisplay = 0;

    	onMount(() => {
    		store.currentScene(currentMessage => {
    			$$invalidate(0, currentScene = currentMessage);
    		});

    		store.casterDisplay(currentMessage => {
    			$$invalidate(1, casterDisplay = currentMessage);
    		});
    	});

    	const writable_props = ["currentScene"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("currentScene" in $$props) $$invalidate(0, currentScene = $$props.currentScene);
    	};

    	$$self.$capture_state = () => ({
    		fade,
    		onMount,
    		store,
    		currentScene,
    		Caster,
    		Desk,
    		PowerRankings,
    		DefaultScene,
    		PlayerCard,
    		casterDisplay
    	});

    	$$self.$inject_state = $$props => {
    		if ("currentScene" in $$props) $$invalidate(0, currentScene = $$props.currentScene);
    		if ("casterDisplay" in $$props) $$invalidate(1, casterDisplay = $$props.casterDisplay);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [currentScene, casterDisplay];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { currentScene: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*currentScene*/ ctx[0] === undefined && !("currentScene" in props)) {
    			console.warn("<App> was created without expected prop 'currentScene'");
    		}
    	}

    	get currentScene() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set currentScene(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		currentScene: ''
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
