using System.ComponentModel;

namespace Runic.ApiExtractor.Fixture;

/// <summary>Selects how a <see cref="Widget"/> starts.</summary>
public enum StartMode
{
    /// <summary>Start at once.</summary>
    Immediate = 0,

    /// <summary>Wait for a signal.</summary>
    Deferred = 1,
}

/// <summary>Describes one command, like <c>CommandDescriptor&lt;T&gt;</c>.</summary>
/// <typeparam name="T">The command state.</typeparam>
/// <param name="Name">The command name.</param>
/// <param name="ExecuteAsync">Runs the command.</param>
public sealed record CommandDescriptor<T>(
    string Name,
    Func<T, CancellationToken, object?, Task>? ExecuteAsync = null)
    where T : class;

/// <summary>A widget with every member shape the extractor renders.</summary>
/// <remarks>See <see cref="StartAsync(StartMode, string?, CancellationToken)"/>.</remarks>
public class Widget : IDisposable, INotifyPropertyChanged, IInternalMarker
{
    /// <summary>The default name.</summary>
    public const string DefaultName = "widget";

    /// <summary>Creates a widget.</summary>
    /// <param name="name">An optional name.</param>
    public Widget(string? name = null) => Name = name;

    /// <summary>The optional name.</summary>
    public string? Name { get; init; }

    /// <summary>Labels that may contain nulls.</summary>
    public required IReadOnlyList<string?> Labels { get; set; }

    /// <summary>A nullable array of non-null strings.</summary>
    public string[]? Aliases { get; protected set; }

    /// <summary>A nullable value tuple.</summary>
    public (int Count, string? Label)? Summary { get; set; }

    /// <summary>Gets an item.</summary>
    /// <param name="index">The index.</param>
    public string? this[int index] => null;

    /// <inheritdoc/>
    public event PropertyChangedEventHandler? PropertyChanged;

    /// <summary>Starts the widget.</summary>
    /// <param name="mode">The start mode.</param>
    /// <param name="reason">Why it starts.</param>
    /// <param name="cancellationToken">Cancels the start.</param>
    /// <returns>The previous name, if any.</returns>
    /// <exception cref="InvalidOperationException">The widget is disposed.</exception>
    public virtual Task<string?> StartAsync(
        StartMode mode = StartMode.Deferred,
        string? reason = null,
        CancellationToken cancellationToken = default) =>
        Task.FromResult(Name);

    /// <summary>Finds a value.</summary>
    /// <typeparam name="TValue">The value type.</typeparam>
    public TValue? Find<TValue>(Func<TValue, bool> match, params TValue[] values)
        where TValue : notnull =>
        values.FirstOrDefault(match);

    /// <summary>Returns its argument.</summary>
    public T Echo<T>(T value) => value;

    /// <summary>Converts the widget.</summary>
    public TResult Convert<TResult>(Func<Widget, TResult> convert)
        where TResult : class?, new() =>
        convert(this);

    /// <summary>Combines two widgets.</summary>
    public static Widget operator +(Widget left, Widget right) => left;

    /// <inheritdoc/>
    public void Dispose() => GC.SuppressFinalize(this);

    /// <inheritdoc/>
    public override string ToString() => Name ?? DefaultName;

    void IInternalMarker.Mark()
    {
    }

    /// <summary>Raises <see cref="PropertyChanged"/>.</summary>
    protected virtual void OnPropertyChanged(string propertyName) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}

/// <summary>Extensions for <see cref="Widget"/>.</summary>
public static class WidgetExtensions
{
    /// <summary>Names a widget.</summary>
    public static Widget Named(this Widget widget, string name) => widget;
}

/// <summary>A callback.</summary>
public delegate void WidgetCallback<in T>(T value, string? note) where T : struct;

/// <summary>A covariant source.</summary>
public interface ISource<out T>
{
    /// <summary>Reads a value.</summary>
    T Read();
}

internal interface IInternalMarker
{
    void Mark();
}

internal sealed class Hidden
{
}
